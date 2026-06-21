#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const DEFAULT_SOURCE_TOKEN = "a8b66c2c34a6e82a27c705fe51222a12";
const DEFAULT_ALIAS = "fete";
const DEFAULT_ARCHIVE_ALIAS = "fete-2026";
const DEFAULT_TITLE = "OOOC’s route for Fête";
const DEFAULT_DESCRIPTION =
	"A handmade Fête day route you can edit, save, or open in maps.";

const loadEnvFile = (name) => {
	const file = path.join(process.cwd(), name);
	if (!fs.existsSync(file)) return;
	for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const index = trimmed.indexOf("=");
		if (index === -1) continue;
		const key = trimmed.slice(0, index).trim();
		let value = trimmed.slice(index + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
};

const parseArgs = () => {
	const args = new Map();
	for (const arg of process.argv.slice(2)) {
		const [key, value] = arg.replace(/^--/, "").split("=");
		args.set(key, value ?? "true");
	}
	return {
		sourceToken: args.get("source-token") || DEFAULT_SOURCE_TOKEN,
		alias: args.get("alias") || DEFAULT_ALIAS,
		archiveAlias:
			args.get("archive-alias") === "false"
				? null
				: args.get("archive-alias") || DEFAULT_ARCHIVE_ALIAS,
		title: args.get("title") || DEFAULT_TITLE,
		description: args.get("description") || DEFAULT_DESCRIPTION,
	};
};

const normalizeSlug = (value) => {
	const slug = String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	if (!slug) throw new Error("Alias is required");
	return slug;
};

const randomId = () => crypto.randomUUID();

loadEnvFile(".env.local");
loadEnvFile(".env");

const config = parseArgs();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error("DATABASE_URL is required");
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	max: 1,
	connect_timeout: 5,
	idle_timeout: 5,
	prepare: false,
});

try {
	await sql`
		CREATE TABLE IF NOT EXISTS app_published_plans (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			kind TEXT NOT NULL CHECK (kind IN ('official_plan')) DEFAULT 'official_plan',
			status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived', 'disabled')) DEFAULT 'draft',
			active_version_id TEXT,
			source_plan_id TEXT,
			source_share_token TEXT,
			created_by TEXT,
			updated_by TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS app_published_plan_versions (
			id TEXT PRIMARY KEY,
			published_plan_id TEXT NOT NULL REFERENCES app_published_plans(id) ON DELETE CASCADE,
			version_number INTEGER NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			plan_date DATE NOT NULL,
			stops_json JSONB NOT NULL DEFAULT '[]'::jsonb,
			source_plan_updated_at TIMESTAMPTZ,
			published_by TEXT,
			published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			archived_at TIMESTAMPTZ,
			UNIQUE (published_plan_id, version_number)
		)
	`;
	await sql`
		CREATE TABLE IF NOT EXISTS app_published_plan_aliases (
			path_slug TEXT PRIMARY KEY,
			published_plan_id TEXT REFERENCES app_published_plans(id) ON DELETE SET NULL,
			target_version_id TEXT REFERENCES app_published_plan_versions(id) ON DELETE SET NULL,
			canonical_slug TEXT,
			status TEXT NOT NULL CHECK (status IN ('active', 'redirect', 'gone')) DEFAULT 'active',
			redirect_to_slug TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;
	await sql`
		CREATE INDEX IF NOT EXISTS idx_app_published_plan_versions_plan
		ON app_published_plan_versions (published_plan_id, version_number DESC)
	`;
	await sql`
		CREATE INDEX IF NOT EXISTS idx_app_published_plan_aliases_status
		ON app_published_plan_aliases (status, path_slug)
	`;

	const sourceRows = await sql`
		SELECT
			p.id,
			p.plan_date,
			p.share_token,
			p.updated_at,
			COALESCE(
				json_agg(
					json_build_object(
						'eventKey', s.event_key,
						'stopOrder', s.stop_order,
						'locked', s.locked,
						'arrivalTime', s.arrival_time,
						'departureTime', s.departure_time,
						'travelMinutesFromPrevious', s.travel_minutes_from_previous
					)
					ORDER BY s.stop_order ASC
				) FILTER (WHERE s.id IS NOT NULL),
				'[]'::json
			) AS stops
		FROM app_user_plans p
		LEFT JOIN app_user_plan_stops s ON s.plan_id = p.id
		WHERE p.share_token = ${config.sourceToken}
			AND p.visibility = 'unlisted'
		GROUP BY p.id
		LIMIT 1
	`;
	const source = sourceRows[0];
	if (!source) {
		throw new Error("Source shared plan was not found or is not unlisted");
	}

	const alias = normalizeSlug(config.alias);
	const archiveAlias = config.archiveAlias
		? normalizeSlug(config.archiveAlias)
		: null;

	const published = await sql.begin(async (tx) => {
		const existing = await tx`
			SELECT p.id
			FROM app_published_plan_aliases a
			JOIN app_published_plans p ON p.id = a.published_plan_id
			WHERE a.path_slug = ${alias}
			LIMIT 1
		`;
		const publishedPlanId = existing[0]?.id || randomId();
		const versionRows = await tx`
			SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
			FROM app_published_plan_versions
			WHERE published_plan_id = ${publishedPlanId}
		`;
		const versionNumber = Number(versionRows[0]?.next_version || 1);
		const versionId = randomId();
		const stops = Array.isArray(source.stops)
			? source.stops.map((stop, index) => ({
					eventKey: String(stop.eventKey || "").toLowerCase(),
					stopOrder: index + 1,
					locked: Boolean(stop.locked),
					arrivalTime: stop.arrivalTime || null,
					departureTime: stop.departureTime || null,
					travelMinutesFromPrevious:
						typeof stop.travelMinutesFromPrevious === "number"
							? stop.travelMinutesFromPrevious
							: null,
				}))
			: [];

		await tx`
			INSERT INTO app_published_plans (
				id,
				title,
				kind,
				status,
				active_version_id,
				source_plan_id,
				source_share_token,
				created_by,
				updated_by,
				updated_at
			)
			VALUES (
				${publishedPlanId},
				${config.title},
				'official_plan',
				'active',
				${versionId},
				${source.id},
				${source.share_token},
				'seed-script',
				'seed-script',
				NOW()
			)
			ON CONFLICT (id)
			DO UPDATE SET
				title = EXCLUDED.title,
				status = 'active',
				active_version_id = EXCLUDED.active_version_id,
				source_plan_id = EXCLUDED.source_plan_id,
				source_share_token = EXCLUDED.source_share_token,
				updated_by = EXCLUDED.updated_by,
				updated_at = NOW()
		`;
		await tx`
			INSERT INTO app_published_plan_versions (
				id,
				published_plan_id,
				version_number,
				title,
				description,
				plan_date,
				stops_json,
				source_plan_updated_at,
				published_by
			)
			VALUES (
				${versionId},
				${publishedPlanId},
				${versionNumber},
				${config.title},
				${config.description},
				${source.plan_date},
				${tx.json(stops)},
				${source.updated_at},
				'seed-script'
			)
		`;
		await tx`
			INSERT INTO app_published_plan_aliases (
				path_slug,
				published_plan_id,
				target_version_id,
				canonical_slug,
				status,
				redirect_to_slug,
				updated_at
			)
			VALUES (
				${alias},
				${publishedPlanId},
				${versionId},
				${alias},
				'active',
				NULL,
				NOW()
			)
			ON CONFLICT (path_slug)
			DO UPDATE SET
				published_plan_id = EXCLUDED.published_plan_id,
				target_version_id = EXCLUDED.target_version_id,
				canonical_slug = EXCLUDED.canonical_slug,
				status = 'active',
				redirect_to_slug = NULL,
				updated_at = NOW()
		`;
		if (archiveAlias) {
			await tx`
				INSERT INTO app_published_plan_aliases (
					path_slug,
					published_plan_id,
					target_version_id,
					canonical_slug,
					status,
					redirect_to_slug,
					updated_at
				)
				VALUES (
					${archiveAlias},
					${publishedPlanId},
					${versionId},
					${archiveAlias},
					'active',
					NULL,
					NOW()
				)
				ON CONFLICT (path_slug)
				DO UPDATE SET
					published_plan_id = EXCLUDED.published_plan_id,
					target_version_id = EXCLUDED.target_version_id,
					canonical_slug = EXCLUDED.canonical_slug,
					status = 'active',
					redirect_to_slug = NULL,
					updated_at = NOW()
			`;
			await tx`
				UPDATE app_published_plan_versions
				SET archived_at = COALESCE(archived_at, NOW())
				WHERE id = ${versionId}
			`;
		}
		return {
			publishedPlanId,
			versionId,
			versionNumber,
			stopCount: stops.length,
			alias,
			archiveAlias,
		};
	});

	console.log(JSON.stringify({ ok: true, ...published }, null, 2));
} catch (error) {
	console.error(
		JSON.stringify(
			{ ok: false, error: error instanceof Error ? error.message : String(error) },
			null,
			2,
		),
	);
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 1 });
}
