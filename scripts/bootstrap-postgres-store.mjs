import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import Papa from "papaparse";
import postgres from "postgres";

const KV_TABLE = "app_kv_store";
const EVENT_COLUMNS_TABLE = "app_event_store_columns";
const EVENT_ROWS_TABLE = "app_event_store_rows";
const EVENT_META_TABLE = "app_event_store_meta";
const EVENT_SETTINGS_TABLE = "app_event_store_settings";
const EVENTS_CSV_KEY = "events-store:csv";
const EVENTS_META_KEY = "events-store:meta";
const EVENTS_SETTINGS_KEY = "events-store:settings";
const USERS_COLLECTION_KEY = "users:collection:v1";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
	console.error(
		"DATABASE_URL (or POSTGRES_URL) is required to bootstrap Postgres store.",
	);
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
	onnotice: () => {},
});

const CORE_COLUMN_LABELS = {
	oocPicks: "OOOC Picks",
	nationality: "GB/FR",
	name: "Name",
	date: "Date",
	startTime: "Start Time",
	endTime: "End Time",
	location: "Location",
	arrondissement: "Arr.",
	genre: "Genre",
	price: "Price",
	ticketLink: "Ticket Link",
	age: "Age",
	indoorOutdoor: "Indoor/Outdoor",
	notes: "Notes",
};

const CORE_COLUMN_KEYS = Object.keys(CORE_COLUMN_LABELS);

const normalizeKey = (value) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 64);

const CORE_ALIAS_MAP = new Map(
	[
		["ooc picks", "oocPicks"],
		["oooc picks", "oocPicks"],
		["gb/fr", "nationality"],
		["host country", "nationality"],
		["start time", "startTime"],
		["end time", "endTime"],
		["arr", "arrondissement"],
		["arr.", "arrondissement"],
		["ticket link", "ticketLink"],
		["indoor outdoor", "indoorOutdoor"],
	].map(([left, right]) => [normalizeKey(left), right]),
);

const resolveCoreKeyFromHeader = (header) => {
	const normalized = normalizeKey(header);
	if (CORE_COLUMN_KEYS.includes(normalized)) {
		return normalized;
	}

	const alias = CORE_ALIAS_MAP.get(normalized);
	if (alias) return alias;

	for (const [key, label] of Object.entries(CORE_COLUMN_LABELS)) {
		if (normalizeKey(label) === normalized) {
			return key;
		}
	}

	return null;
};

const sanitizeCsv = (csvContent) => csvContent.replace(/\r\n/g, "\n").trim();

const checksum = (csvContent) =>
	createHash("sha256").update(csvContent).digest("hex").slice(0, 16);

const toSheet = (csvContent) => {
	const parseResult = Papa.parse(csvContent, {
		header: true,
		skipEmptyLines: "greedy",
		transform: (value) => value.trim(),
	});

	const headers = parseResult.meta.fields || [];
	const usedKeys = new Set();
	const mappings = [];
	const columns = [];

	for (const header of headers) {
		const coreKey = resolveCoreKeyFromHeader(header);
		let key = coreKey || normalizeKey(header) || "custom_column";
		if (!coreKey && usedKeys.has(key)) {
			let suffix = 2;
			while (usedKeys.has(`${key}_${suffix}`)) {
				suffix += 1;
			}
			key = `${key}_${suffix}`;
		}
		usedKeys.add(key);
		mappings.push({ header, key });
		columns.push({
			key,
			label: coreKey ? CORE_COLUMN_LABELS[coreKey] : header,
			is_core: Boolean(coreKey),
			is_required: key === "name" || key === "date",
		});
	}

	const rows = parseResult.data.map((rawRow) => {
		const row = {};
		for (const mapping of mappings) {
			row[mapping.key] = rawRow[mapping.header] ?? "";
		}
		return row;
	});

	for (const coreKey of CORE_COLUMN_KEYS) {
		if (!columns.some((column) => column.key === coreKey)) {
			columns.push({
				key: coreKey,
				label: CORE_COLUMN_LABELS[coreKey],
				is_core: true,
				is_required: coreKey === "name" || coreKey === "date",
			});
			for (const row of rows) {
				row[coreKey] = "";
			}
		}
	}

	return { columns, rows };
};

const ensureKvTable = async () => {
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

	await sql`
		CREATE TABLE IF NOT EXISTS app_event_store_settings (
			singleton BOOLEAN PRIMARY KEY DEFAULT TRUE,
			auto_sync_from_google BOOLEAN NOT NULL DEFAULT FALSE,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;
};

const upsertKey = async (key, value) => {
	await sql`
		INSERT INTO app_kv_store (key, value, updated_at)
		VALUES (${key}, ${value}, NOW())
		ON CONFLICT (key)
		DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`;
};

const getKey = async (key) => {
	const rows = await sql`
		SELECT value
		FROM app_kv_store
		WHERE key = ${key}
		LIMIT 1
	`;
	return rows[0]?.value ?? null;
};

const deleteKey = async (key) => {
	await sql`
		DELETE FROM app_kv_store
		WHERE key = ${key}
	`;
};

const bootstrap = async () => {
	const nowIso = new Date().toISOString();

	await ensureKvTable();
	await ensureEventTables();

	const existingRows = await sql`
		SELECT COUNT(*)::int AS count
		FROM app_event_store_rows
	`;

	if ((existingRows[0]?.count ?? 0) === 0) {
		const legacyCsv = await getKey(EVENTS_CSV_KEY);
		let csvContent = "";
		let seedOrigin = "local-file-import";
		let seedBy = "bootstrap-script";

		if (legacyCsv && legacyCsv.trim().length > 0) {
			csvContent = sanitizeCsv(legacyCsv);
			seedOrigin = "legacy-kv-import";
			seedBy = "bootstrap-legacy-migration";
			console.log("Using legacy KV CSV as seed source.");
		} else {
			const csvPath = path.join(process.cwd(), "data", "events.csv");
			const csvRaw = await readFile(csvPath, "utf8");
			csvContent = sanitizeCsv(csvRaw);
			console.log("Using data/events.csv as seed source.");
		}

		if (csvContent.length > 0) {
			const sheet = toSheet(csvContent);

			await sql.begin(async (tx) => {
				await tx`DELETE FROM app_event_store_rows`;
				await tx`DELETE FROM app_event_store_columns`;

				let columnOrder = 0;
				for (const column of sheet.columns) {
					await tx`
						INSERT INTO app_event_store_columns (
							key,
							label,
							is_core,
							is_required,
							display_order,
							created_at,
							updated_at
						)
						VALUES (
							${column.key},
							${column.label},
							${column.is_core},
							${column.is_required},
							${columnOrder},
							NOW(),
							NOW()
						)
					`;
					columnOrder += 1;
				}

				let rowOrder = 0;
				for (const row of sheet.rows) {
					await tx`
						INSERT INTO app_event_store_rows (
							id,
							display_order,
							row_data,
							created_at,
							updated_at
						)
						VALUES (
							${`bootstrap-${rowOrder}`},
							${rowOrder},
							${tx.json(row)},
							NOW(),
							NOW()
						)
					`;
					rowOrder += 1;
				}

				await tx`
					INSERT INTO app_event_store_meta (
						singleton,
						row_count,
						updated_at,
						updated_by,
						origin,
						checksum
					)
					VALUES (
						TRUE,
						${sheet.rows.length},
						${nowIso},
						${seedBy},
						${seedOrigin},
						${checksum(csvContent)}
					)
					ON CONFLICT (singleton)
					DO UPDATE SET
						row_count = EXCLUDED.row_count,
						updated_at = EXCLUDED.updated_at,
						updated_by = EXCLUDED.updated_by,
						origin = EXCLUDED.origin,
						checksum = EXCLUDED.checksum
				`;

				await tx`
					INSERT INTO app_event_store_settings (
						singleton,
						auto_sync_from_google,
						updated_at
					)
					VALUES (TRUE, FALSE, NOW())
					ON CONFLICT (singleton)
					DO UPDATE SET updated_at = NOW()
				`;
			});

			console.log(`Seeded event tables with ${sheet.rows.length} rows.`);

			await deleteKey(EVENTS_CSV_KEY);
			await deleteKey(EVENTS_META_KEY);
			await deleteKey(EVENTS_SETTINGS_KEY);
			console.log("Removed legacy events-store KV keys after table bootstrap.");
		}
	} else {
		console.log("Event tables already contain rows. Skipping seed.");
	}

	const usersInDb = await sql`
		SELECT value
		FROM app_kv_store
		WHERE key = ${USERS_COLLECTION_KEY}
		LIMIT 1
	`;
	if (!usersInDb[0]) {
		await upsertKey(
			USERS_COLLECTION_KEY,
			JSON.stringify({
				version: 1,
				updatedAt: new Date(0).toISOString(),
				records: {},
			}),
		);
		console.log(`Initialized ${USERS_COLLECTION_KEY}.`);
	} else {
		console.log(`${USERS_COLLECTION_KEY} already exists. Skipping init.`);
	}

	const [kvKeyCount, eventRowsCount, eventColumnsCount] = await Promise.all([
		sql`SELECT COUNT(*)::int AS count FROM app_kv_store`,
		sql`SELECT COUNT(*)::int AS count FROM app_event_store_rows`,
		sql`SELECT COUNT(*)::int AS count FROM app_event_store_columns`,
	]);

	console.log(`Postgres KV key count: ${kvKeyCount[0]?.count ?? 0}`);
	console.log(`Event rows count: ${eventRowsCount[0]?.count ?? 0}`);
	console.log(`Event columns count: ${eventColumnsCount[0]?.count ?? 0}`);
};

try {
	await bootstrap();
} catch (error) {
	console.error(
		"Failed to bootstrap Postgres store:",
		error instanceof Error ? error.message : "Unknown error",
	);
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 5 });
}
