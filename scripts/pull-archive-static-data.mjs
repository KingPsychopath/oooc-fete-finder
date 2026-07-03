import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const LOCATION_KV_KEY = "maps:locations:v1";
const SITE_SETTING_KEYS = [
	"ui:sliding-banner:v1",
	"ui:search-chips:v1",
	"events:submissions:settings:v1",
];

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
			process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
		}
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
};

const checksum = (content) =>
	createHash("sha256").update(content).digest("hex").slice(0, 16);

const writeJson = async (outputPath, data) => {
	const content = `${JSON.stringify(data, null, 2)}\n`;
	await writeFile(outputPath, content, "utf8");
	return { path: outputPath, checksum: checksum(content), bytes: content.length };
};

const parseJson = (value, fallback = null) => {
	if (typeof value !== "string" || value.trim().length === 0) return fallback;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
};

const toIsoString = (value) =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNullableIsoString = (value) => (value ? toIsoString(value) : null);

const toDateString = (value) =>
	value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

const cleanString = (value, maxLength) => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
};

const normalizeStops = (value) => {
	if (!Array.isArray(value)) return [];
	return value
		.map((stop) => {
			const row = stop && typeof stop === "object" ? stop : {};
			const eventKey = cleanString(
				typeof row.eventKey === "string"
					? row.eventKey
					: typeof row.event_key === "string"
						? row.event_key
						: null,
				220,
			)?.toLowerCase();
			if (!eventKey) return null;
			const stopOrder = Number(row.stopOrder ?? row.stop_order ?? 0);
			const travelMinutes =
				typeof row.travelMinutesFromPrevious === "number"
					? row.travelMinutesFromPrevious
					: typeof row.travel_minutes_from_previous === "number"
						? row.travel_minutes_from_previous
						: null;
			return {
				eventKey,
				stopOrder: Number.isFinite(stopOrder) ? stopOrder : 0,
				locked: Boolean(row.locked),
				arrivalTime:
					typeof row.arrivalTime === "string"
						? row.arrivalTime
						: typeof row.arrival_time === "string"
							? row.arrival_time
							: null,
				departureTime:
					typeof row.departureTime === "string"
						? row.departureTime
						: typeof row.departure_time === "string"
							? row.departure_time
							: null,
				travelMinutesFromPrevious: travelMinutes,
			};
		})
		.filter(Boolean)
		.sort((left, right) => left.stopOrder - right.stopOrder)
		.map((stop, index) => ({
			...stop,
			stopOrder: Number.isFinite(stop.stopOrder) && stop.stopOrder > 0 ? stop.stopOrder : index + 1,
		}));
};

const normalizeAlias = (row) => ({
	pathSlug: row.path_slug,
	publishedPlanId: row.published_plan_id,
	targetVersionId: row.target_version_id,
	canonicalSlug: row.canonical_slug,
	status: row.status,
	redirectToSlug: row.redirect_to_slug,
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
});

const normalizeResolution = (row) => {
	const alias = normalizeAlias({
		path_slug: row.path_slug,
		published_plan_id: row.published_plan_id,
		target_version_id: row.target_version_id,
		canonical_slug: row.canonical_slug,
		status: row.status,
		redirect_to_slug: row.redirect_to_slug,
		created_at: row.alias_created_at,
		updated_at: row.alias_updated_at,
	});
	return {
		plan: {
			id: row.plan_id,
			title: row.plan_title,
			kind: row.kind,
			status: row.plan_status,
			activeVersionId: row.active_version_id,
			sourcePlanId: null,
			sourceShareToken: null,
			createdBy: null,
			updatedBy: null,
			createdAt: toIsoString(row.plan_created_at),
			updatedAt: toIsoString(row.plan_updated_at),
		},
		version: {
			id: row.version_id,
			publishedPlanId: row.published_plan_id,
			versionNumber: row.version_number,
			title: row.title,
			description: row.description ?? "",
			planDate: toDateString(row.plan_date),
			stops: normalizeStops(row.stops_json),
			sourcePlanUpdatedAt: toNullableIsoString(row.source_plan_updated_at),
			publishedBy: null,
			publishedAt: toIsoString(row.published_at),
			archivedAt: toNullableIsoString(row.archived_at),
		},
		alias,
		canonicalSlug: alias.canonicalSlug || alias.pathSlug,
	};
};

const main = async () => {
	await loadDotEnv();
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
	const exportedAt = new Date().toISOString();

	try {
		const [locationRows, siteRows, aliasRows, publishedRows] =
			await Promise.all([
				sql`
					SELECT value, updated_at
					FROM app_kv_store
					WHERE key = ${LOCATION_KV_KEY}
					LIMIT 1
				`,
				sql`
					SELECT key, value, updated_at
					FROM app_kv_store
					WHERE key = ANY(${SITE_SETTING_KEYS})
					ORDER BY key ASC
				`,
				sql`
					SELECT
						path_slug,
						published_plan_id,
						target_version_id,
						canonical_slug,
						status,
						redirect_to_slug,
						created_at,
						updated_at
					FROM app_published_plan_aliases
					ORDER BY path_slug ASC
				`,
				sql`
					SELECT
						p.id AS plan_id,
						p.title AS plan_title,
						p.kind,
						p.status AS plan_status,
						p.active_version_id,
						p.created_at AS plan_created_at,
						p.updated_at AS plan_updated_at,
						v.id AS version_id,
						v.published_plan_id,
						v.version_number,
						v.title,
						v.description,
						v.plan_date,
						v.stops_json,
						v.source_plan_updated_at,
						v.published_at,
						v.archived_at,
						a.path_slug,
						a.target_version_id,
						a.canonical_slug,
						a.status,
						a.redirect_to_slug,
						a.created_at AS alias_created_at,
						a.updated_at AS alias_updated_at
					FROM app_published_plan_aliases a
					JOIN app_published_plans p ON p.id = a.published_plan_id
					JOIN app_published_plan_versions v ON v.id = a.target_version_id
					WHERE a.status = 'active'
						AND p.status IN ('active', 'archived')
					ORDER BY a.path_slug ASC
				`,
			]);

		const locationPayload = parseJson(locationRows[0]?.value);
		if (!locationPayload?.locations || typeof locationPayload.locations !== "object") {
			throw new Error("Production maps:locations:v1 payload is missing or invalid.");
		}

		const siteSettings = {
			version: 1,
			exportedAt,
			values: Object.fromEntries(
				siteRows.map((row) => [
					row.key,
					{
						updatedAt: toIsoString(row.updated_at),
						value: parseJson(row.value),
					},
				]),
			),
		};
		const publishedPlans = {
			version: 1,
			exportedAt,
			aliases: aliasRows.map(normalizeAlias),
			resolutions: publishedRows.map(normalizeResolution),
		};

		const outputs = await Promise.all([
			writeJson(path.join(process.cwd(), "data", "event-locations.json"), {
				...locationPayload,
				exportedAt,
				sourceUpdatedAt: toIsoString(locationRows[0].updated_at),
			}),
			writeJson(
				path.join(process.cwd(), "data", "archive-site-settings.json"),
				siteSettings,
			),
			writeJson(
				path.join(process.cwd(), "data", "archive-published-plans.json"),
				publishedPlans,
			),
		]);

		const locationCount = Object.keys(locationPayload.locations).length;
		console.log("Pulled production archive static data");
		console.log(`- locations: ${locationCount}`);
		console.log(`- site setting records: ${siteRows.length}`);
		console.log(`- published aliases: ${aliasRows.length}`);
		console.log(`- published resolutions: ${publishedRows.length}`);
		for (const output of outputs) {
			console.log(
				`- ${path.relative(process.cwd(), output.path)}: ${output.bytes} bytes (${output.checksum})`,
			);
		}
	} finally {
		await sql.end({ timeout: 5 });
	}
};

main().catch((error) => {
	console.error(
		error instanceof Error
			? error.message
			: "Failed to pull archive static data.",
	);
	process.exit(1);
});
