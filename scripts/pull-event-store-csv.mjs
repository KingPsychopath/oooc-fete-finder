import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import postgres from "postgres";

const DEFAULT_OUTPUT_PATH = path.join(process.cwd(), "data", "events.csv");
const LEGACY_FEATURED_COLUMN_KEY = "featured";

const loadDotEnv = async () => {
	const envPath = path.join(process.cwd(), ".env");
	try {
		const content = await readFile(envPath, "utf8");
		for (const line of content.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
			if (!match) continue;
			const [, key, rawValue] = match;
			if (process.env[key]) continue;
			const value = rawValue
				.trim()
				.replace(/^(['"])(.*)\1$/, "$2");
			process.env[key] = value;
		}
	} catch (error) {
		if (error?.code !== "ENOENT") {
			throw error;
		}
	}
};

const parseArgs = () => {
	const args = process.argv.slice(2);
	const outputFlagIndex = args.findIndex(
		(arg) => arg === "--output" || arg === "-o",
	);
	const outputPath =
		outputFlagIndex >= 0 && args[outputFlagIndex + 1] ?
			path.resolve(args[outputFlagIndex + 1])
		:	DEFAULT_OUTPUT_PATH;
	return { outputPath };
};

const toCsvValue = (value) => {
	if (value == null) return "";
	if (typeof value === "string") return value;
	return String(value);
};

const checksum = (content) =>
	createHash("sha256").update(content).digest("hex").slice(0, 16);

const main = async () => {
	await loadDotEnv();
	const { outputPath } = parseArgs();
	const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
	if (!databaseUrl) {
		console.error("Missing DATABASE_URL or POSTGRES_URL.");
		process.exit(1);
	}

	const sql = postgres(databaseUrl, {
		prepare: false,
		max: 1,
		onnotice: () => {},
	});

	try {
		const [columns, rows, metaRows] = await Promise.all([
			sql`
				SELECT key, label, display_order
				FROM app_event_store_columns
				ORDER BY display_order ASC, key ASC
			`,
			sql`
				SELECT row_data
				FROM app_event_store_rows
				ORDER BY display_order ASC, id ASC
			`,
			sql`
				SELECT row_count, updated_at, updated_by, origin, checksum
				FROM app_event_store_meta
				WHERE singleton = TRUE
				LIMIT 1
			`,
		]);

		const exportColumns = columns.filter(
			(column) => column.key !== LEGACY_FEATURED_COLUMN_KEY,
		);
		if (exportColumns.length === 0 || rows.length === 0) {
			throw new Error("Postgres event store has no exportable sheet data.");
		}

		const fields = exportColumns.map((column) => column.label);
		const data = rows.map((row) => {
			const rowData =
				row.row_data && typeof row.row_data === "object" ? row.row_data : {};
			return Object.fromEntries(
				exportColumns.map((column) => [
					column.label,
					toCsvValue(rowData[column.key]),
				]),
			);
		});
		const csvContent = `${Papa.unparse(data, { columns: fields })}\n`;
		await writeFile(outputPath, csvContent, "utf8");

		const meta = metaRows[0] ?? null;
		console.log("Pulled Postgres event store to CSV");
		console.log(`- output: ${path.relative(process.cwd(), outputPath)}`);
		console.log(`- rows: ${rows.length}`);
		console.log(`- columns: ${exportColumns.length}`);
		console.log(`- csv checksum: ${checksum(csvContent)}`);
		if (meta) {
			console.log(`- store meta rows: ${meta.row_count}`);
			console.log(`- store updated by: ${meta.updated_by}`);
			console.log(`- store origin: ${meta.origin}`);
			console.log(
				`- store updated at: ${
					meta.updated_at instanceof Date ?
						meta.updated_at.toISOString()
					:	meta.updated_at
				}`,
			);
			console.log(`- store checksum: ${meta.checksum}`);
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
};

main().catch((error) => {
	console.error(
		error instanceof Error ? error.message : "Failed to pull event store CSV.",
	);
	process.exit(1);
});
