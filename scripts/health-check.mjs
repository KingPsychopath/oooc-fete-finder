import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const adminKey = process.env.ADMIN_KEY || "";
const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

if (!databaseUrl) {
	console.error("Missing DATABASE_URL (or POSTGRES_URL)");
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
});

const printSection = (title) => {
	console.log(`\n=== ${title} ===`);
};

const run = async () => {
	printSection("Postgres Connectivity");
	await sql`select 1 as ok`;
	console.log("Postgres connection: OK");

	printSection("KV Store Keys");
	const keys = await sql`select key, updated_at from app_kv_store order by key`;
	for (const row of keys) {
		console.log(`- ${row.key} (updated ${row.updated_at.toISOString()})`);
	}
	console.log(`Key count: ${keys.length}`);

	printSection("Events CSV Row Counts");
	const metaRows = await sql`select value from app_kv_store where key = 'events-store:meta' limit 1`;
	const csvRows = await sql`select value from app_kv_store where key = 'events-store:csv' limit 1`;

	if (!metaRows[0] || !csvRows[0]) {
		console.log("events-store keys missing");
	} else {
		const meta = JSON.parse(metaRows[0].value);
		const csv = csvRows[0].value;
		const csvLineCount = csv
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0).length;
		const csvDataRows = Math.max(0, csvLineCount - 1);
		console.log(`meta.rowCount: ${meta.rowCount}`);
		console.log(`raw CSV rows (excluding header): ${csvDataRows}`);
		console.log(`metadata updatedAt: ${meta.updatedAt}`);
	}

	if (adminKey) {
		printSection("Admin Health Endpoint");
		const healthResponse = await fetch(`${baseUrl}/api/admin/health`, {
			headers: {
				"x-admin-key": adminKey,
			},
		});

		if (!healthResponse.ok) {
			console.log(`GET /api/admin/health failed: HTTP ${healthResponse.status}`);
		} else {
			const healthJson = await healthResponse.json();
			console.log(JSON.stringify(healthJson, null, 2));
		}

		printSection("Admin Postgres KV Endpoint");
		const kvResponse = await fetch(
			`${baseUrl}/api/admin/postgres/kv?prefix=events-store:&limit=20`,
			{
				headers: {
					"x-admin-key": adminKey,
				},
			},
		);

		if (!kvResponse.ok) {
			console.log(
				`GET /api/admin/postgres/kv failed: HTTP ${kvResponse.status}`,
			);
		} else {
			const kvJson = await kvResponse.json();
			console.log(JSON.stringify(kvJson, null, 2));
		}
	} else {
		console.log("\nADMIN_KEY not set, skipping /api/admin/health request.");
	}
};

run()
	.catch((error) => {
		console.error("Health check failed:", error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	})
	.finally(async () => {
		await sql.end({ timeout: 5 });
	});
