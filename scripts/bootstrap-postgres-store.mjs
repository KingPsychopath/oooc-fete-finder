import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import postgres from "postgres";

const TABLE_NAME = "app_kv_store";
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
});

const nowIso = new Date().toISOString();

const sanitizeCsv = (csvContent) => csvContent.replace(/\r\n/g, "\n").trim();

const estimateRowCount = (csvContent) => {
	const lines = csvContent
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length <= 1) return 0;
	return lines.length - 1;
};

const checksum = (csvContent) =>
	createHash("sha256").update(csvContent).digest("hex").slice(0, 16);

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

const bootstrap = async () => {
	await sql`
		CREATE TABLE IF NOT EXISTS app_kv_store (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	const eventsCsvInDb = await getKey(EVENTS_CSV_KEY);
	if (!eventsCsvInDb) {
		const csvPath = path.join(process.cwd(), "data", "events.csv");
		const csvRaw = await readFile(csvPath, "utf8");
		const csvContent = sanitizeCsv(csvRaw);

		if (csvContent.length > 0) {
			const rowCount = estimateRowCount(csvContent);
			await upsertKey(EVENTS_CSV_KEY, csvContent);
			await upsertKey(
				EVENTS_META_KEY,
				JSON.stringify({
					rowCount,
					updatedAt: nowIso,
					updatedBy: "bootstrap-script",
					origin: "local-file-import",
					checksum: checksum(csvContent),
				}),
			);
			console.log(`Seeded ${EVENTS_CSV_KEY} with ${rowCount} rows.`);
		}
	} else {
		console.log(`${EVENTS_CSV_KEY} already exists. Skipping seed.`);
	}

	const settingsInDb = await getKey(EVENTS_SETTINGS_KEY);
	if (!settingsInDb) {
		await upsertKey(
			EVENTS_SETTINGS_KEY,
			JSON.stringify({
				sourcePreference: "store-first",
				autoSyncFromGoogle: false,
				updatedAt: nowIso,
			}),
		);
		console.log(`Initialized ${EVENTS_SETTINGS_KEY}.`);
	} else {
		console.log(`${EVENTS_SETTINGS_KEY} already exists. Skipping init.`);
	}

	const usersInDb = await getKey(USERS_COLLECTION_KEY);
	if (!usersInDb) {
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

	const keys = await sql`
		SELECT key
		FROM app_kv_store
		ORDER BY key ASC
	`;
	console.log(`Postgres KV key count: ${keys.length}`);
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
