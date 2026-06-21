import "server-only";

import { randomUUID } from "crypto";
import type {
	PublishedPlan,
	PublishedPlanAdminSummary,
	PublishedPlanAlias,
	PublishedPlanAliasResolution,
	PublishedPlanAliasStatus,
	PublishedPlanResolution,
	PublishedPlanSourceStatus,
	PublishedPlanStatus,
	PublishedPlanStopSnapshot,
	PublishedPlanVersion,
	SharedPlanSearchResult,
} from "@/features/plans/published-plan-types";
import type { SharedPlan } from "@/features/plans/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";
import { getUserPlanRepository } from "./user-plan-repository";

declare global {
	var __ooocFeteFinderPublishedPlanRepository:
		| PublishedPlanRepository
		| undefined;
}

type PublishedPlanRow = {
	id: string;
	title: string;
	kind: "official_plan";
	status: PublishedPlanStatus;
	active_version_id: string | null;
	source_plan_id: string | null;
	source_share_token: string | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: string | Date;
	updated_at: string | Date;
};

type PublishedPlanVersionRow = {
	id: string;
	published_plan_id: string;
	version_number: number;
	title: string;
	description: string | null;
	plan_date: string | Date;
	stops_json: unknown;
	source_plan_updated_at: string | Date | null;
	published_by: string | null;
	published_at: string | Date;
	archived_at: string | Date | null;
};

type PublishedPlanAliasRow = {
	path_slug: string;
	published_plan_id: string | null;
	target_version_id: string | null;
	canonical_slug: string | null;
	status: PublishedPlanAliasStatus;
	redirect_to_slug: string | null;
	created_at: string | Date;
	updated_at: string | Date;
};

type PublishedPlanJoinedRow = PublishedPlanRow &
	PublishedPlanVersionRow &
	PublishedPlanAliasRow & {
		plan_id: string;
		plan_title: string;
		plan_status: PublishedPlanStatus;
		plan_created_at: string | Date;
		plan_updated_at: string | Date;
		version_id: string;
		alias_created_at: string | Date;
		alias_updated_at: string | Date;
	};

type SharedPlanLookupRow = {
	id: string;
	visibility: string;
	share_token: string | null;
};

const RESERVED_PLAN_ALIASES = new Set([
	"new",
	"api",
	"admin",
	"route",
	"routes",
	"share",
	"shared",
]);

const cleanString = (
	value: string | null | undefined,
	maxLength: number,
): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, maxLength);
};

const normalizeSlug = (value: string): string => {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	if (!slug) throw new Error("Plan alias is required");
	if (RESERVED_PLAN_ALIASES.has(slug)) {
		throw new Error(`"${slug}" is a reserved plan alias`);
	}
	return slug;
};

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toDateString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);

const normalizeStops = (value: unknown): PublishedPlanStopSnapshot[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((stop) => {
			const row = stop as Record<string, unknown>;
			const eventKey = cleanString(
				typeof row.eventKey === "string"
					? row.eventKey
					: typeof row.event_key === "string"
						? row.event_key
						: null,
				220,
			)?.toLowerCase();
			if (!eventKey) return null;
			return {
				eventKey,
				stopOrder: Number(row.stopOrder ?? row.stop_order ?? 0),
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
				travelMinutesFromPrevious:
					typeof row.travelMinutesFromPrevious === "number"
						? row.travelMinutesFromPrevious
						: typeof row.travel_minutes_from_previous === "number"
							? row.travel_minutes_from_previous
							: null,
			};
		})
		.filter((stop): stop is PublishedPlanStopSnapshot => Boolean(stop))
		.sort((left, right) => left.stopOrder - right.stopOrder)
		.map((stop, index) => ({
			...stop,
			stopOrder: Number.isFinite(stop.stopOrder) ? stop.stopOrder : index + 1,
		}));
};

const snapshotStopsFromSharedPlan = (
	plan: SharedPlan,
): PublishedPlanStopSnapshot[] =>
	plan.stops
		.slice()
		.sort((left, right) => left.stopOrder - right.stopOrder)
		.map((stop, index) => ({
			eventKey: stop.eventKey.toLowerCase(),
			stopOrder: index + 1,
			locked: stop.locked,
			arrivalTime: stop.arrivalTime,
			departureTime: stop.departureTime,
			travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
		}));

const stopsSignature = (stops: PublishedPlanStopSnapshot[]): string =>
	JSON.stringify(
		stops
			.slice()
			.sort((left, right) => left.stopOrder - right.stopOrder)
			.map((stop) => ({
				eventKey: stop.eventKey.toLowerCase(),
				stopOrder: stop.stopOrder,
				arrivalTime: stop.arrivalTime,
				departureTime: stop.departureTime,
				travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
			})),
	);

const normalizePlan = (row: PublishedPlanRow): PublishedPlan => ({
	id: row.id,
	title: row.title,
	kind: row.kind,
	status: row.status,
	activeVersionId: row.active_version_id,
	sourcePlanId: row.source_plan_id,
	sourceShareToken: row.source_share_token,
	createdBy: row.created_by,
	updatedBy: row.updated_by,
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
});

const normalizeVersion = (
	row: PublishedPlanVersionRow,
): PublishedPlanVersion => ({
	id: row.id,
	publishedPlanId: row.published_plan_id,
	versionNumber: row.version_number,
	title: row.title,
	description: row.description ?? "",
	planDate: toDateString(row.plan_date),
	stops: normalizeStops(row.stops_json),
	sourcePlanUpdatedAt: row.source_plan_updated_at
		? toIsoString(row.source_plan_updated_at)
		: null,
	publishedBy: row.published_by,
	publishedAt: toIsoString(row.published_at),
	archivedAt: row.archived_at ? toIsoString(row.archived_at) : null,
});

const normalizeAlias = (row: PublishedPlanAliasRow): PublishedPlanAlias => ({
	pathSlug: row.path_slug,
	publishedPlanId: row.published_plan_id,
	targetVersionId: row.target_version_id,
	canonicalSlug: row.canonical_slug,
	status: row.status,
	redirectToSlug: row.redirect_to_slug,
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
});

const normalizeJoinedResolution = (
	row: PublishedPlanJoinedRow,
): PublishedPlanResolution => {
	const plan = normalizePlan({
		id: row.plan_id,
		title: row.plan_title,
		kind: row.kind,
		status: row.plan_status,
		active_version_id: row.active_version_id,
		source_plan_id: row.source_plan_id,
		source_share_token: row.source_share_token,
		created_by: row.created_by,
		updated_by: row.updated_by,
		created_at: row.plan_created_at,
		updated_at: row.plan_updated_at,
	});
	const version = normalizeVersion({
		id: row.version_id,
		published_plan_id: row.published_plan_id,
		version_number: row.version_number,
		title: row.title,
		description: row.description,
		plan_date: row.plan_date,
		stops_json: row.stops_json,
		source_plan_updated_at: row.source_plan_updated_at,
		published_by: row.published_by,
		published_at: row.published_at,
		archived_at: row.archived_at,
	});
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
		plan,
		version,
		alias,
		canonicalSlug: alias.canonicalSlug || alias.pathSlug,
	};
};

export class PublishedPlanRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
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
		await this.sql`
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
		await this.sql`
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
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_published_plan_versions_plan
			ON app_published_plan_versions (published_plan_id, version_number DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_published_plan_aliases_status
			ON app_published_plan_aliases (status, path_slug)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async resolveAlias(slugInput: string): Promise<PublishedPlanAliasResolution> {
		await this.ready();
		const slug = normalizeSlug(slugInput);
		const aliasRows = await this.sql<PublishedPlanAliasRow[]>`
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
			WHERE path_slug = ${slug}
			LIMIT 1
		`;
		const aliasRow = aliasRows[0];
		if (!aliasRow) return { kind: "not_found" };
		const alias = normalizeAlias(aliasRow);
		if (alias.status === "redirect" && alias.redirectToSlug) {
			return {
				kind: "redirect",
				value: { alias, redirectToSlug: alias.redirectToSlug },
			};
		}
		if (alias.status === "gone") {
			return { kind: "gone", value: { alias } };
		}
		if (!alias.publishedPlanId || !alias.targetVersionId) {
			return { kind: "gone", value: { alias } };
		}

		const rows = await this.sql<PublishedPlanJoinedRow[]>`
			SELECT
				p.id AS plan_id,
				p.title AS plan_title,
				p.kind,
				p.status AS plan_status,
				p.active_version_id,
				p.source_plan_id,
				p.source_share_token,
				p.created_by,
				p.updated_by,
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
				v.published_by,
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
			WHERE a.path_slug = ${slug}
				AND a.status = 'active'
				AND p.status IN ('active', 'archived')
			LIMIT 1
		`;
		const row = rows[0];
		if (!row) return { kind: "gone", value: { alias } };
		return { kind: "published", value: normalizeJoinedResolution(row) };
	}

	async publishFromSharedPlan(input: {
		shareToken: string;
		slug: string;
		title?: string | null;
		description?: string | null;
		publishedBy?: string | null;
	}): Promise<PublishedPlanResolution> {
		await this.ready();
		const slug = normalizeSlug(input.slug);
		const shareToken = cleanString(input.shareToken, 80);
		if (!shareToken) throw new Error("Shared plan token is required");
		const sourcePlan = await getUserPlanRepository()?.findSharedPlan({
			shareToken,
		});
		if (!sourcePlan) {
			throw new Error("Shared plan was not found or is no longer shared");
		}

		const planTitle = cleanString(input.title, 160) ?? sourcePlan.title;
		const description =
			cleanString(input.description, 500) ??
			"A handmade Fête day route you can edit, save, or open in maps.";
		const publishedBy = cleanString(input.publishedBy, 160);

		await this.sql.begin(async (transactionSql) => {
			const sql = transactionSql as unknown as Sql;
			const existingPlans = await sql<
				{ id: string; active_version_id: string | null }[]
			>`
				SELECT p.id, p.active_version_id
				FROM app_published_plan_aliases a
				JOIN app_published_plans p ON p.id = a.published_plan_id
				WHERE a.path_slug = ${slug}
				LIMIT 1
			`;
			const publishedPlanId = existingPlans[0]?.id ?? randomUUID();
			const versionRows = await sql<{ next_version: number }[]>`
				SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
				FROM app_published_plan_versions
				WHERE published_plan_id = ${publishedPlanId}
			`;
			const versionNumber = versionRows[0]?.next_version ?? 1;
			const versionId = randomUUID();
			const stops = snapshotStopsFromSharedPlan(sourcePlan);

			await sql`
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
					${planTitle},
					'official_plan',
					'active',
					${versionId},
					${sourcePlan.id},
					${sourcePlan.shareToken},
					${publishedBy},
					${publishedBy},
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
			await sql`
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
					${planTitle},
					${description},
					${sourcePlan.planDate},
					${sql.json(stops)},
					${sourcePlan.updatedAt},
					${publishedBy}
				)
			`;
			await sql`
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
					${slug},
					${publishedPlanId},
					${versionId},
					${slug},
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
		});

		const resolution = await this.resolveAlias(slug);
		if (resolution.kind !== "published") {
			throw new Error("Published plan was saved but could not be resolved");
		}
		return resolution.value;
	}

	async republishFromSource(input: {
		publishedPlanId: string;
		publishedBy?: string | null;
	}): Promise<PublishedPlanResolution> {
		await this.ready();
		const planRows = await this.sql<PublishedPlanRow[]>`
			SELECT
				id,
				title,
				kind,
				status,
				active_version_id,
				source_plan_id,
				source_share_token,
				created_by,
				updated_by,
				created_at,
				updated_at
			FROM app_published_plans
			WHERE id = ${input.publishedPlanId}
			LIMIT 1
		`;
		const plan = planRows[0] ? normalizePlan(planRows[0]) : null;
		if (!plan?.sourceShareToken) {
			throw new Error("Published plan does not have a source shared plan");
		}
		const aliasRows = await this.sql<PublishedPlanAliasRow[]>`
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
			WHERE published_plan_id = ${plan.id}
				AND canonical_slug = path_slug
			ORDER BY updated_at DESC
			LIMIT 1
		`;
		const alias = aliasRows[0]?.path_slug;
		if (!alias) throw new Error("Published plan has no canonical alias");
		return this.publishFromSharedPlan({
			shareToken: plan.sourceShareToken,
			slug: alias,
			title: plan.title,
			publishedBy: input.publishedBy,
		});
	}

	async createArchiveAlias(input: {
		sourceSlug: string;
		archiveSlug: string;
		updatedBy?: string | null;
	}): Promise<PublishedPlanAlias> {
		await this.ready();
		const sourceSlug = normalizeSlug(input.sourceSlug);
		const archiveSlug = normalizeSlug(input.archiveSlug);
		const source = await this.resolveAlias(sourceSlug);
		if (source.kind !== "published") {
			throw new Error("Source alias must point to an active published plan");
		}
		await this.sql`
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
				${archiveSlug},
				${source.value.plan.id},
				${source.value.version.id},
				${archiveSlug},
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
		await this.sql`
			UPDATE app_published_plan_versions
			SET archived_at = COALESCE(archived_at, NOW())
			WHERE id = ${source.value.version.id}
		`;
		const alias = await this.getAlias(archiveSlug);
		if (!alias) throw new Error("Archive alias was not saved");
		return alias;
	}

	async redirectAlias(input: {
		slug: string;
		redirectToSlug: string;
	}): Promise<PublishedPlanAlias> {
		await this.ready();
		const slug = normalizeSlug(input.slug);
		const redirectToSlug = normalizeSlug(input.redirectToSlug);
		await this.sql`
			INSERT INTO app_published_plan_aliases (
				path_slug,
				status,
				redirect_to_slug,
				updated_at
			)
			VALUES (${slug}, 'redirect', ${redirectToSlug}, NOW())
			ON CONFLICT (path_slug)
			DO UPDATE SET
				published_plan_id = NULL,
				target_version_id = NULL,
				status = 'redirect',
				redirect_to_slug = EXCLUDED.redirect_to_slug,
				updated_at = NOW()
		`;
		const alias = await this.getAlias(slug);
		if (!alias) throw new Error("Redirect alias was not saved");
		return alias;
	}

	async markAliasGone(slugInput: string): Promise<PublishedPlanAlias> {
		await this.ready();
		const slug = normalizeSlug(slugInput);
		await this.sql`
			INSERT INTO app_published_plan_aliases (
				path_slug,
				status,
				updated_at
			)
			VALUES (${slug}, 'gone', NOW())
			ON CONFLICT (path_slug)
			DO UPDATE SET
				published_plan_id = NULL,
				target_version_id = NULL,
				status = 'gone',
				redirect_to_slug = NULL,
				updated_at = NOW()
		`;
		const alias = await this.getAlias(slug);
		if (!alias) throw new Error("Gone alias was not saved");
		return alias;
	}

	async getAlias(slugInput: string): Promise<PublishedPlanAlias | null> {
		await this.ready();
		const slug = normalizeSlug(slugInput);
		const rows = await this.sql<PublishedPlanAliasRow[]>`
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
			WHERE path_slug = ${slug}
			LIMIT 1
		`;
		return rows[0] ? normalizeAlias(rows[0]) : null;
	}

	async listAdminSummaries(): Promise<PublishedPlanAdminSummary[]> {
		await this.ready();
		const rows = await this.sql<
			Array<PublishedPlanRow & { aliases: unknown; active_version: unknown }>
		>`
			SELECT
				p.id,
				p.title,
				p.kind,
				p.status,
				p.active_version_id,
				p.source_plan_id,
				p.source_share_token,
				p.created_by,
				p.updated_by,
				p.created_at,
				p.updated_at,
				COALESCE(
					json_agg(
						json_build_object(
							'path_slug', a.path_slug,
							'published_plan_id', a.published_plan_id,
							'target_version_id', a.target_version_id,
							'canonical_slug', a.canonical_slug,
							'status', a.status,
							'redirect_to_slug', a.redirect_to_slug,
							'created_at', a.created_at,
							'updated_at', a.updated_at
						)
						ORDER BY a.path_slug
					) FILTER (WHERE a.path_slug IS NOT NULL),
					'[]'::json
				) AS aliases,
				CASE
					WHEN v.id IS NULL THEN NULL
					ELSE json_build_object(
						'id', v.id,
						'published_plan_id', v.published_plan_id,
						'version_number', v.version_number,
						'title', v.title,
						'description', v.description,
						'plan_date', v.plan_date,
						'stops_json', v.stops_json,
						'source_plan_updated_at', v.source_plan_updated_at,
						'published_by', v.published_by,
						'published_at', v.published_at,
						'archived_at', v.archived_at
					)
				END AS active_version
			FROM app_published_plans p
			LEFT JOIN app_published_plan_versions v ON v.id = p.active_version_id
			LEFT JOIN app_published_plan_aliases a ON a.published_plan_id = p.id
			GROUP BY p.id, v.id
			ORDER BY p.updated_at DESC
		`;

		return Promise.all(
			rows.map(async (row) => {
				const plan = normalizePlan(row);
				const activeVersion = row.active_version
					? normalizeVersion(
							row.active_version as unknown as PublishedPlanVersionRow,
						)
					: null;
				const aliases = Array.isArray(row.aliases)
					? row.aliases.map((alias) =>
							normalizeAlias(alias as PublishedPlanAliasRow),
						)
					: [];
				const sourcePlan = plan.sourceShareToken
					? ((await getUserPlanRepository()?.findSharedPlan({
							shareToken: plan.sourceShareToken,
						})) ?? null)
					: null;
				return {
					plan,
					activeVersion,
					aliases,
					sourceStatus: await this.getSourceStatus(
						plan,
						activeVersion,
						sourcePlan,
					),
					sourcePlan,
					stopCount: activeVersion?.stops.length ?? 0,
				};
			}),
		);
	}

	async searchSharedPlans(input: {
		query?: string | null;
		limit?: number;
	}): Promise<SharedPlanSearchResult[]> {
		await this.ready();
		const query = cleanString(input.query, 160)?.toLowerCase() ?? "";
		const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
		const rows = await this.sql<
			Array<{
				id: string;
				share_token: string;
				title: string;
				plan_date: string | Date;
				owner_display_name: string | null;
				stop_count: number;
				updated_at: string | Date;
			}>
		>`
			SELECT
				p.id,
				p.share_token,
				p.title,
				p.plan_date,
				NULLIF(TRIM(COALESCE(users.first_name, '')), '') AS owner_display_name,
				COUNT(s.id)::int AS stop_count,
				p.updated_at
			FROM app_user_plans p
			LEFT JOIN app_users users ON users.id::text = p.user_id
			LEFT JOIN app_user_plan_stops s ON s.plan_id = p.id
			WHERE p.visibility = 'unlisted'
				AND p.share_token IS NOT NULL
				AND (
					${query} = ''
					OR LOWER(p.share_token) = ${query}
					OR LOWER(p.title) LIKE ${`%${query}%`}
					OR LOWER(COALESCE(users.first_name, '')) LIKE ${`%${query}%`}
					OR p.plan_date::text LIKE ${`%${query}%`}
				)
			GROUP BY p.id, users.first_name
			ORDER BY p.updated_at DESC
			LIMIT ${limit}
		`;
		return rows.map((row) => ({
			id: row.id,
			shareToken: row.share_token,
			title: row.title,
			planDate: toDateString(row.plan_date),
			ownerDisplayName:
				cleanString(row.owner_display_name, 120) ?? "Fete Finder guest",
			stopCount: row.stop_count,
			updatedAt: toIsoString(row.updated_at),
		}));
	}

	private async getSourceStatus(
		plan: PublishedPlan,
		activeVersion: PublishedPlanVersion | null,
		sourcePlan: SharedPlan | null,
	): Promise<PublishedPlanSourceStatus> {
		if (!plan.sourcePlanId && !plan.sourceShareToken) return "none";
		if (!activeVersion) return "unknown";
		if (!sourcePlan) {
			const lookupRows = await this.sql<SharedPlanLookupRow[]>`
				SELECT id, visibility, share_token
				FROM app_user_plans
				WHERE id = ${plan.sourcePlanId}
					OR share_token = ${plan.sourceShareToken}
				LIMIT 1
			`;
			const lookup = lookupRows[0];
			if (!lookup) return "deleted";
			return lookup.visibility === "unlisted" ? "unknown" : "unshared";
		}
		const currentStops = snapshotStopsFromSharedPlan(sourcePlan);
		if (
			activeVersion.sourcePlanUpdatedAt === sourcePlan.updatedAt &&
			stopsSignature(activeVersion.stops) === stopsSignature(currentStops)
		) {
			return "current";
		}
		return "changed";
	}
}

export const getPublishedPlanRepository =
	(): PublishedPlanRepository | null => {
		if (
			globalThis.__ooocFeteFinderPublishedPlanRepository &&
			globalThis.__ooocFeteFinderPublishedPlanRepository instanceof
				PublishedPlanRepository
		) {
			return globalThis.__ooocFeteFinderPublishedPlanRepository;
		}
		const sql = getPostgresClient();
		if (!sql) return null;
		const repository = new PublishedPlanRepository(sql);
		globalThis.__ooocFeteFinderPublishedPlanRepository = repository;
		return repository;
	};
