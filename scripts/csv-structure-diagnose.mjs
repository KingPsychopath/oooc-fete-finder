#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createSign } from "node:crypto";
import Papa from "papaparse";

const ENV_FILES = [".env.local", ".env"];

const parseArgs = (argv) => {
	const args = {
		file: null,
		url: null,
		remote: false,
		limit: 30,
		strictRaw: false,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === "--file") {
			args.file = argv[i + 1] || null;
			i += 1;
			continue;
		}
		if (token === "--url") {
			args.url = argv[i + 1] || null;
			i += 1;
			continue;
		}
		if (token === "--remote") {
			args.remote = true;
			continue;
		}
		if (token === "--limit") {
			const raw = Number.parseInt(argv[i + 1] || "", 10);
			if (Number.isFinite(raw) && raw > 0) {
				args.limit = raw;
			}
			i += 1;
			continue;
		}
		if (token === "--strict-raw") {
			args.strictRaw = true;
			continue;
		}
	}

	return args;
};

const parseEnvFile = (raw) => {
	const env = {};
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match) continue;
		const [, key, valueRaw] = match;
		let value = valueRaw.trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
	return env;
};

const loadLocalEnv = async (cwd) => {
	const env = {};
	for (const filename of ENV_FILES) {
		const fullPath = path.join(cwd, filename);
		if (!existsSync(fullPath)) continue;
		try {
			const raw = await readFile(fullPath, "utf8");
			Object.assign(env, parseEnvFile(raw));
		} catch {
			// Ignore unreadable env files; we'll fail later with a clearer source error.
		}
	}
	return env;
};

const extractSheetId = (value) => {
	const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	return match ? match[1] : null;
};

const extractGid = (value) => {
	const match = value.match(/[?&]gid=(\d+)/);
	return match ? match[1] : null;
};

const toGoogleCsvExportUrl = (value, fallbackGid = "0") => {
	const sheetId = extractSheetId(value);
	if (!sheetId) return value;
	const gid = extractGid(value) || fallbackGid;
	return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
};

const resolveRemoteUrl = (env, explicitUrl) => {
	if (explicitUrl) {
		return toGoogleCsvExportUrl(explicitUrl, env.GOOGLE_SHEET_GID || "0");
	}

	const remoteUrl = env.REMOTE_CSV_URL || "";
	if (remoteUrl) {
		return toGoogleCsvExportUrl(remoteUrl, env.GOOGLE_SHEET_GID || "0");
	}

	const sheetId = env.GOOGLE_SHEET_ID || "";
	if (sheetId) {
		const gid = env.GOOGLE_SHEET_GID || "0";
		return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
	}

	return null;
};

const extractCredentialsFromEnv = (env) => {
	const raw = (env.GOOGLE_SERVICE_ACCOUNT_KEY || "").trim();
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw);
		if (!parsed?.client_email || !parsed?.private_key) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
};

const encodeBase64Url = (value) =>
	Buffer.from(value)
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

const createGoogleJwt = (credentials) => {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = {
		iss: credentials.client_email,
		scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
		aud: "https://oauth2.googleapis.com/token",
		exp: now + 3600,
		iat: now,
	};

	const unsignedToken = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
	const signature = createSign("RSA-SHA256")
		.update(unsignedToken)
		.sign(credentials.private_key, "base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	return `${unsignedToken}.${signature}`;
};

const exchangeGoogleAccessToken = async (credentials) => {
	const assertion = createGoogleJwt(credentials);
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion,
		}),
		signal: AbortSignal.timeout(12000),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Token exchange failed (${response.status}): ${body}`);
	}

	const payload = await response.json();
	const accessToken = payload.access_token;
	if (!accessToken || typeof accessToken !== "string") {
		throw new Error("Token exchange returned no access_token");
	}
	return accessToken;
};

const sheetsValuesToCsv = (values, options = { strictRaw: false }) => {
	if (!Array.isArray(values) || values.length === 0) return "";
	const headerWidth = Array.isArray(values[0]) ? values[0].length : 0;
	return values
		.map((row) => {
			const normalizedRow = Array.isArray(row) ? [...row] : [];
			if (!options.strictRaw) {
				while (normalizedRow.length < headerWidth) {
					normalizedRow.push("");
				}
			}

			return normalizedRow
				.map((cell) => {
					const text = cell === null || cell === undefined ? "" : String(cell);
					if (
						text.includes(",") ||
						text.includes("\n") ||
						text.includes('"')
					) {
						return `"${text.replace(/"/g, '""')}"`;
					}
					return text;
				})
				.join(",");
		})
		.join("\n");
};

const fetchGoogleSheetViaServiceAccount = async (
	sheetId,
	range,
	credentials,
	strictRaw,
) => {
	const token = await exchangeGoogleAccessToken(credentials);
	const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
	const response = await fetch(endpoint, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
		signal: AbortSignal.timeout(15000),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Sheets API fetch failed (${response.status}): ${body}`);
	}

	const payload = await response.json();
	const values = payload?.values || [];
	return sheetsValuesToCsv(values, { strictRaw });
};

const fetchRemoteCsvContent = async (env, explicitUrl, strictRaw) => {
	const errors = [];
	const remoteUrl = resolveRemoteUrl(env, explicitUrl);
	const sheetId =
		extractSheetId(explicitUrl || "") ||
		(env.GOOGLE_SHEET_ID || "").trim() ||
		(remoteUrl ? extractSheetId(remoteUrl) || "" : "");

	if (remoteUrl) {
		try {
			const response = await fetch(remoteUrl, {
				signal: AbortSignal.timeout(15000),
			});
			if (!response.ok) {
				throw new Error(`${response.status} ${response.statusText}`);
			}
			return {
				content: await response.text(),
				sourceLabel: remoteUrl,
				strategy: "public_url",
			};
		} catch (error) {
			errors.push(
				`Public URL strategy failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (sheetId) {
		const credentials = extractCredentialsFromEnv(env);
		if (credentials) {
			try {
				const range = (env.GOOGLE_SHEET_RANGE || "A:Z").trim() || "A:Z";
				const content = await fetchGoogleSheetViaServiceAccount(
					sheetId,
					range,
					credentials,
					strictRaw,
				);
				return {
					content,
					sourceLabel: `Google Sheets API (sheetId=${sheetId}, range=${range})`,
					strategy: "service_account",
				};
			} catch (error) {
				errors.push(
					`Service account strategy failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} else {
			errors.push(
				"Service account strategy unavailable: GOOGLE_SERVICE_ACCOUNT_KEY missing/invalid.",
			);
		}
	}

	if (errors.length === 0) {
		throw new Error(
			"Could not resolve remote CSV source. Set REMOTE_CSV_URL/GOOGLE_SHEET_ID or pass --url.",
		);
	}

	throw new Error(errors.join(" "));
};

const truncate = (value, max = 180) =>
	value.length > max ? `${value.slice(0, max)}...` : value;

const diagnoseCsvStructure = (csvContent, limit) => {
	const parsed = Papa.parse(csvContent, {
		header: false,
		skipEmptyLines: "greedy",
		dynamicTyping: false,
	});

	const rows = Array.isArray(parsed.data) ? parsed.data : [];
	const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
	const expectedColumns = headerRow.length;
	const mismatches = [];

	for (let index = 1; index < rows.length; index += 1) {
		const row = Array.isArray(rows[index]) ? rows[index] : [];
		if (row.length === expectedColumns) continue;
		mismatches.push({
			csvRowNumber: index + 1,
			dataRowNumber: index,
			actualColumns: row.length,
			expectedColumns,
			rowPreview: truncate(row.join(" | ")),
		});
	}

	return {
		headerColumns: expectedColumns,
		totalRows: rows.length,
		totalDataRows: Math.max(0, rows.length - 1),
		mismatches,
		visibleMismatches: mismatches.slice(0, limit),
		parserErrors: parsed.errors,
	};
};

const usage = () => {
	console.log("Usage:");
	console.log("  node scripts/csv-structure-diagnose.mjs --file <path/to/file.csv>");
	console.log("  node scripts/csv-structure-diagnose.mjs --remote");
	console.log(
		"  node scripts/csv-structure-diagnose.mjs --url <https://docs.google.com/...>",
	);
	console.log("Optional:");
	console.log("  --limit <number>  Max mismatches to print (default 30)");
	console.log(
		"  --strict-raw      Disable row padding when using Sheets API values (diagnostic mode)",
	);
};

const main = async () => {
	const args = parseArgs(process.argv.slice(2));
	const cwd = process.cwd();
	const env = await loadLocalEnv(cwd);

	let source = "";
	let csvContent = "";
	let strategy = "";

	if (args.file) {
		const fullPath = path.isAbsolute(args.file) ? args.file : path.join(cwd, args.file);
		source = fullPath;
		csvContent = await readFile(fullPath, "utf8");
	} else if (args.remote || args.url) {
		const remote = await fetchRemoteCsvContent(env, args.url, args.strictRaw);
		source = remote.sourceLabel;
		csvContent = remote.content;
		strategy = remote.strategy;
	} else {
		usage();
		process.exit(1);
	}

	const report = diagnoseCsvStructure(csvContent, args.limit);

	console.log(`Source: ${source}`);
	if (strategy) {
		console.log(`Fetch strategy: ${strategy}`);
	}
	if (args.strictRaw) {
		console.log("Strict mode: raw Sheets values (no row padding)");
	}
	console.log(`Header columns: ${report.headerColumns}`);
	console.log(`Data rows: ${report.totalDataRows}`);
	console.log(`Mismatched rows: ${report.mismatches.length}`);

	if (report.mismatches.length === 0) {
		console.log("No row-structure mismatches found.");
		return;
	}

	console.log("");
	console.log(`Showing first ${report.visibleMismatches.length} mismatch(es):`);
	for (const mismatch of report.visibleMismatches) {
		const delta =
			mismatch.actualColumns > mismatch.expectedColumns ?
				`+${mismatch.actualColumns - mismatch.expectedColumns}`
			:	`-${mismatch.expectedColumns - mismatch.actualColumns}`;
		console.log(
			`- CSV row ${mismatch.csvRowNumber} (data row ${mismatch.dataRowNumber}): ${mismatch.actualColumns}/${mismatch.expectedColumns} columns (${delta})`,
		);
		console.log(`  Preview: ${mismatch.rowPreview}`);
	}

	const tooMany = report.mismatches.filter(
		(row) => row.actualColumns > row.expectedColumns,
	).length;
	const tooFew = report.mismatches.length - tooMany;
	console.log("");
	console.log(`Breakdown: ${tooMany} row(s) with extra columns, ${tooFew} with missing columns.`);
	console.log(
		"Tip: check unquoted commas, stray quotes, or accidental line breaks inside cells.",
	);
};

main().catch((error) => {
	console.error(
		`CSV diagnosis failed: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exit(1);
});
