import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import Papa from "papaparse";
import postgres from "postgres";

const TABLE_NAME = "app_kv_store";
const EVENTS_CSV_KEY = "events-store:csv";
const EVENTS_META_KEY = "events-store:meta";
const DEFAULT_BASE_URL = "http://localhost:3000";
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const adminKey = process.env.ADMIN_KEY || "";

if (!databaseUrl) {
	console.error("Missing DATABASE_URL (or POSTGRES_URL)");
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
	onnotice: () => {},
});

const ensureTable = async () => {
	await sql`
		CREATE TABLE IF NOT EXISTS app_kv_store (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;
};

const countCsvRows = (csv) => {
	const lines = csv
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	return Math.max(0, lines.length - 1);
};

const randomSample = (rows, count) => {
	if (rows.length <= count) return rows.slice();
	const next = rows.slice();
	for (let index = next.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[next[index], next[randomIndex]] = [next[randomIndex], next[index]];
	}
	return next.slice(0, count);
};

const safeParseJson = (value) => {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

const getRecord = async (key) => {
	const rows = await sql`
		SELECT key, value, updated_at
		FROM app_kv_store
		WHERE key = ${key}
		LIMIT 1
	`;
	return rows[0] ?? null;
};

const getStoreStats = async () => {
	const [meta, csv, keyCount] = await Promise.all([
		getRecord(EVENTS_META_KEY),
		getRecord(EVENTS_CSV_KEY),
		sql`SELECT COUNT(*)::int AS count FROM app_kv_store`,
	]);

	const parsedMeta = meta?.value ? safeParseJson(meta.value) : null;
	const metadataRowCount =
		parsedMeta && typeof parsedMeta.rowCount === "number" ?
			Math.max(0, parsedMeta.rowCount)
		:	0;
	const csvRawRowCount = csv?.value ? countCsvRows(csv.value) : 0;

	return {
		keyCount: keyCount[0]?.count ?? 0,
		hasMeta: Boolean(meta),
		hasCsv: Boolean(csv),
		metadataRowCount,
		csvRawRowCount,
		rowCountMatches: metadataRowCount === csvRawRowCount,
		metaUpdatedAt: parsedMeta?.updatedAt || null,
	};
};

const cmdStatus = async () => {
	await ensureTable();
	await sql`select 1`;
	const stats = await getStoreStats();
	console.log("\nPostgres status");
	console.log(`- table: ${TABLE_NAME}`);
	console.log(`- key count: ${stats.keyCount}`);
	console.log(`- has events meta: ${stats.hasMeta}`);
	console.log(`- has events csv: ${stats.hasCsv}`);
	console.log(`- events metadata rows: ${stats.metadataRowCount}`);
	console.log(`- events raw csv rows: ${stats.csvRawRowCount}`);
	console.log(`- row counts match: ${stats.rowCountMatches ? "yes" : "no"}`);
	console.log(`- meta updated at: ${stats.metaUpdatedAt ?? "n/a"}`);
};

const cmdKeys = async (prefix = "", limit = 100) => {
	await ensureTable();
	const normalizedLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 100, 500));
	const rows =
		!prefix ?
			await sql`
				SELECT key, updated_at
				FROM app_kv_store
				ORDER BY key ASC
				LIMIT ${normalizedLimit}
			`
		:	await sql`
				SELECT key, updated_at
				FROM app_kv_store
				WHERE key LIKE ${`${prefix}%`}
				ORDER BY key ASC
				LIMIT ${normalizedLimit}
			`;

	console.log(`\nKeys (${rows.length})`);
	for (const row of rows) {
		console.log(`- ${row.key} (${row.updated_at.toISOString()})`);
	}
};

const cmdGet = async (key) => {
	if (!key) {
		console.log("Usage: get <key>");
		return;
	}

	await ensureTable();
	const record = await getRecord(key);
	if (!record) {
		console.log(`No record found for key: ${key}`);
		return;
	}

	console.log(`\n${record.key}`);
	console.log(`updated_at: ${record.updated_at.toISOString()}`);
	console.log(record.value);
};

const cmdRows = async () => {
	await ensureTable();
	const stats = await getStoreStats();
	console.log("\nEvents row diagnostics");
	console.log(`- metadata rowCount: ${stats.metadataRowCount}`);
	console.log(`- raw CSV row count: ${stats.csvRawRowCount}`);
	console.log(`- counts match: ${stats.rowCountMatches ? "yes" : "no"}`);
};

const cmdSample = async (count = 2) => {
	await ensureTable();
	const normalizedCount = Math.max(1, Math.min(Number.parseInt(String(count), 10) || 2, 20));
	const csvRecord = await getRecord(EVENTS_CSV_KEY);
	if (!csvRecord) {
		console.log("No events CSV found in store.");
		return;
	}

	const parsed = Papa.parse(csvRecord.value, {
		header: true,
		skipEmptyLines: "greedy",
		transform: (value) => value.trim(),
	});
	const rows = parsed.data || [];
	const headers = parsed.meta.fields || [];
	const sample = randomSample(rows, normalizedCount);

	console.log(`\nRandom sample (${sample.length} rows)`);
	console.log(headers.join(" | "));
	for (const row of sample) {
		const line = headers.map((header) => row[header] ?? "").join(" | ");
		console.log(line);
	}
};

const cmdHealth = async (baseUrl = DEFAULT_BASE_URL) => {
	const normalizedBaseUrl = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
	if (!adminKey) {
		console.log("ADMIN_KEY not set. Skipping /api/admin/health call.");
		return;
	}

	const response = await fetch(`${normalizedBaseUrl}/api/admin/health`, {
		headers: { "x-admin-key": adminKey },
	});

	if (!response.ok) {
		console.log(`GET /api/admin/health failed: HTTP ${response.status}`);
		return;
	}

	const payload = await response.json();
	console.log(JSON.stringify(payload, null, 2));
};

const printHelp = () => {
	console.log(`
oooc-fete-finder db CLI

Usage:
  pnpm run db:cli
  pnpm run db:cli -- <command> [args]

Commands:
  status                    Postgres + store summary
  keys [prefix] [limit]     List keys in app_kv_store
  get <key>                 Show value for one key
  rows                      Compare events row counts (meta vs raw CSV)
  sample [count]            Print random event rows from store CSV
  health [baseUrl]          Call /api/admin/health (requires ADMIN_KEY)
  help                      Show this message
`);
};

const runCommand = async (rawInput) => {
	const [command = "", ...args] = rawInput.trim().split(/\s+/).filter(Boolean);
	switch (command.toLowerCase()) {
		case "status":
			await cmdStatus();
			return;
		case "keys":
			await cmdKeys(args[0] || "", args[1] || 100);
			return;
		case "get":
			await cmdGet(args[0] || "");
			return;
		case "rows":
			await cmdRows();
			return;
		case "sample":
			await cmdSample(args[0] || 2);
			return;
		case "health":
			await cmdHealth(args[0] || DEFAULT_BASE_URL);
			return;
		case "help":
			printHelp();
			return;
		default:
			if (!command) return;
			console.log(`Unknown command: ${command}`);
			printHelp();
	}
};

const runInteractive = async () => {
	printHelp();
	console.log("Interactive mode: type a command or 'exit'.");

	const rl = createInterface({ input, output });
	try {
		while (true) {
			const answer = (await rl.question("db> ")).trim();
			if (!answer) continue;
			if (answer === "exit" || answer === "quit") break;
			await runCommand(answer);
		}
	} finally {
		rl.close();
	}
};

const main = async () => {
	const args = process.argv.slice(2).filter((arg) => arg !== "--");
	if (args.length > 0) {
		await runCommand(args.join(" "));
	} else {
		await runInteractive();
	}
};

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	})
	.finally(async () => {
		await sql.end({ timeout: 5 });
	});
