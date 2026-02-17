import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import Papa from "papaparse";
import postgres from "postgres";

const TABLE_NAME = "app_kv_store";
const EVENT_COLUMNS_TABLE = "app_event_store_columns";
const EVENT_ROWS_TABLE = "app_event_store_rows";
const EVENT_META_TABLE = "app_event_store_meta";
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

const ensureEventTables = async () => {
	await sql`
		CREATE TABLE IF NOT EXISTS app_event_store_columns (
			key TEXT PRIMARY KEY,
			label TEXT NOT NULL,
			is_core BOOLEAN NOT NULL,
			is_required BOOLEAN NOT NULL,
			display_order INTEGER NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS app_event_store_rows (
			id TEXT PRIMARY KEY,
			display_order INTEGER NOT NULL,
			row_data JSONB NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	await sql`
		CREATE TABLE IF NOT EXISTS app_event_store_meta (
			singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
			row_count INTEGER NOT NULL DEFAULT 0,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_by TEXT NOT NULL DEFAULT 'system',
			origin TEXT NOT NULL DEFAULT 'manual',
			checksum TEXT NOT NULL DEFAULT ''
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

const getEventTableStats = async () => {
	await ensureEventTables();
	const [rowCountRows, columnCountRows, metaRows] = await Promise.all([
		sql`SELECT COUNT(*)::int AS count FROM app_event_store_rows`,
		sql`SELECT COUNT(*)::int AS count FROM app_event_store_columns`,
		sql`
			SELECT row_count, updated_at, updated_by, origin
			FROM app_event_store_meta
			WHERE singleton = TRUE
			LIMIT 1
		`,
	]);

	const rowCount = rowCountRows[0]?.count ?? 0;
	const columnCount = columnCountRows[0]?.count ?? 0;
	const meta = metaRows[0] || null;
	const metadataRowCount = meta?.row_count ?? 0;

	return {
		rowCount,
		columnCount,
		hasMeta: Boolean(meta),
		metadataRowCount,
		rowCountMatches: rowCount === metadataRowCount,
		updatedAt: meta?.updated_at ? meta.updated_at.toISOString() : null,
		updatedBy: meta?.updated_by || null,
		origin: meta?.origin || null,
	};
};

const cmdStatus = async () => {
	await ensureTable();
	await ensureEventTables();
	await sql`select 1`;
	const stats = await getStoreStats();
	const eventStats = await getEventTableStats();
	console.log("\nPostgres status");
	console.log(`- table: ${TABLE_NAME}`);
	console.log(`- key count: ${stats.keyCount}`);
	console.log(`- has events meta: ${stats.hasMeta}`);
	console.log(`- has events csv: ${stats.hasCsv}`);
	console.log(`- events metadata rows: ${stats.metadataRowCount}`);
	console.log(`- events raw csv rows: ${stats.csvRawRowCount}`);
	console.log(`- row counts match: ${stats.rowCountMatches ? "yes" : "no"}`);
	console.log(`- meta updated at: ${stats.metaUpdatedAt ?? "n/a"}`);
	console.log(`- event table rows (${EVENT_ROWS_TABLE}): ${eventStats.rowCount}`);
	console.log(
		`- event table columns (${EVENT_COLUMNS_TABLE}): ${eventStats.columnCount}`,
	);
	console.log(
		`- event meta row count (${EVENT_META_TABLE}.row_count): ${eventStats.metadataRowCount}`,
	);
	console.log(
		`- event tables/meta aligned: ${eventStats.rowCountMatches ? "yes" : "no"}`,
	);
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
	await ensureEventTables();
	const [stats, eventStats] = await Promise.all([
		getStoreStats(),
		getEventTableStats(),
	]);
	console.log("\nEvents row diagnostics");
	console.log(`- legacy KV metadata rowCount: ${stats.metadataRowCount}`);
	console.log(`- legacy KV raw CSV row count: ${stats.csvRawRowCount}`);
	console.log(`- legacy KV counts match: ${stats.rowCountMatches ? "yes" : "no"}`);
	console.log(`- table rows count: ${eventStats.rowCount}`);
	console.log(`- table meta row_count: ${eventStats.metadataRowCount}`);
	console.log(`- table counts match: ${eventStats.rowCountMatches ? "yes" : "no"}`);
};

const cmdSample = async (count = 2) => {
	await ensureTable();
	await ensureEventTables();
	const normalizedCount = Math.max(1, Math.min(Number.parseInt(String(count), 10) || 2, 20));
	const [columnsRows, tableRows] = await Promise.all([
		sql`
			SELECT key, label
			FROM app_event_store_columns
			ORDER BY display_order ASC, key ASC
		`,
		sql`
			SELECT row_data
			FROM app_event_store_rows
			ORDER BY display_order ASC
		`,
	]);

	if (columnsRows.length > 0 && tableRows.length > 0) {
		const sample = randomSample(tableRows, normalizedCount);
		console.log(`\nRandom sample (${sample.length} rows)`);
		console.log(columnsRows.map((column) => column.label).join(" | "));

		for (const row of sample) {
			const values = columnsRows.map((column) => {
				const value =
					row?.row_data && typeof row.row_data === "object" ?
						row.row_data[column.key]
					:	"";
				return value == null ? "" : String(value);
			});
			console.log(values.join(" | "));
		}
		return;
	}

	const csvRecord = await getRecord(EVENTS_CSV_KEY);
	if (!csvRecord) {
		console.log("No events found in table store or legacy KV store.");
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

	console.log(`\nRandom sample (${sample.length} rows) [legacy KV CSV]`);
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
  status                    Postgres + KV + event tables summary
  keys [prefix] [limit]     List keys in app_kv_store
  get <key>                 Show value for one key
  rows                      Compare row counts across legacy KV and event tables
  sample [count]            Print random event rows (table store first)
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
