import "server-only";

import { randomBytes, randomUUID } from "crypto";
import { isValidUserId } from "@/features/auth/user-id";
import type {
	PlanUpsertInput,
	PlanVisibility,
	UserPlan,
} from "@/features/plans/types";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderUserPlanRepository: UserPlanRepository | undefined;
}

type PlanRow = {
	id: string;
	user_id: string | null;
	owner_key: string;
	plan_date: string | Date;
	title: string;
	visibility: PlanVisibility;
	share_token: string | null;
	created_at: string | Date;
	updated_at: string | Date;
	stops: unknown;
};

const cleanString = (
	value: string | null | undefined,
	maxLength: number,
): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed.slice(0, maxLength);
};

const sanitizeUserId = (userId: string | null | undefined): string | null => {
	const cleaned = cleanString(userId, 80);
	return cleaned && isValidUserId(cleaned) ? cleaned : null;
};

const sanitizeOwnerKey = (ownerKey: string): string => {
	const cleaned = cleanString(ownerKey, 160);
	if (!cleaned) throw new Error("Owner key is required");
	return cleaned;
};

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toDateString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);

const createShareToken = (): string => randomBytes(16).toString("hex");

const normalizePlan = (row: PlanRow): UserPlan => ({
	id: row.id,
	userId: row.user_id,
	ownerKey: row.owner_key,
	planDate: toDateString(row.plan_date),
	title: row.title,
	visibility: row.visibility,
	shareToken: row.share_token,
	createdAt: toIsoString(row.created_at),
	updatedAt: toIsoString(row.updated_at),
	stops: Array.isArray(row.stops)
		? row.stops.map((stop) => {
				const value = stop as Record<string, unknown>;
				return {
					id: String(value.id ?? ""),
					eventKey: String(value.event_key ?? value.eventKey ?? ""),
					stopOrder: Number(value.stop_order ?? value.stopOrder ?? 0),
					locked: Boolean(value.locked),
					arrivalTime:
						typeof value.arrival_time === "string"
							? value.arrival_time
							: typeof value.arrivalTime === "string"
								? value.arrivalTime
								: null,
					departureTime:
						typeof value.departure_time === "string"
							? value.departure_time
							: typeof value.departureTime === "string"
								? value.departureTime
								: null,
					travelMinutesFromPrevious:
						typeof value.travel_minutes_from_previous === "number"
							? value.travel_minutes_from_previous
							: typeof value.travelMinutesFromPrevious === "number"
								? value.travelMinutesFromPrevious
								: null,
					createdAt: toIsoString(String(value.created_at ?? value.createdAt)),
					updatedAt: toIsoString(String(value.updated_at ?? value.updatedAt)),
				};
			})
		: [],
});

export class UserPlanRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_plans (
				id TEXT PRIMARY KEY,
				user_id TEXT,
				owner_key TEXT NOT NULL,
				plan_date DATE NOT NULL,
				title TEXT NOT NULL,
				visibility TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted')) DEFAULT 'private',
				share_token TEXT UNIQUE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_plan_stops (
				id TEXT PRIMARY KEY,
				plan_id TEXT NOT NULL REFERENCES app_user_plans(id) ON DELETE CASCADE,
				event_key TEXT NOT NULL,
				stop_order INTEGER NOT NULL,
				locked BOOLEAN NOT NULL DEFAULT FALSE,
				arrival_time TEXT,
				departure_time TEXT,
				travel_minutes_from_previous INTEGER,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE (plan_id, event_key)
			)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_plans_owner_date
			ON app_user_plans (owner_key, plan_date DESC, updated_at DESC)
		`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_plan_stops_plan_order
			ON app_user_plan_stops (plan_id, stop_order)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async listPlans(input: { ownerKey: string; limit?: number }): Promise<
		UserPlan[]
	> {
		await this.ready();
		const ownerKey = sanitizeOwnerKey(input.ownerKey);
		const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
		const rows = await this.sql<PlanRow[]>`
			SELECT
				p.id,
				p.user_id,
				p.owner_key,
				p.plan_date,
				p.title,
				p.visibility,
				p.share_token,
				p.created_at,
				p.updated_at,
				COALESCE(
					json_agg(
						json_build_object(
							'id', s.id,
							'event_key', s.event_key,
							'stop_order', s.stop_order,
							'locked', s.locked,
							'arrival_time', s.arrival_time,
							'departure_time', s.departure_time,
							'travel_minutes_from_previous', s.travel_minutes_from_previous,
							'created_at', s.created_at,
							'updated_at', s.updated_at
						)
						ORDER BY s.stop_order ASC
					) FILTER (WHERE s.id IS NOT NULL),
					'[]'::json
				) AS stops
			FROM app_user_plans p
			LEFT JOIN app_user_plan_stops s ON s.plan_id = p.id
			WHERE p.owner_key = ${ownerKey}
			GROUP BY p.id
			ORDER BY p.plan_date DESC, p.updated_at DESC
			LIMIT ${limit}
		`;
		return rows.map(normalizePlan);
	}

	async upsertPlan(input: {
		ownerKey: string;
		userId: string | null;
		plan: PlanUpsertInput;
	}): Promise<UserPlan> {
		await this.ready();
		const ownerKey = sanitizeOwnerKey(input.ownerKey);
		const userId = sanitizeUserId(input.userId);
		const planId = cleanString(input.plan.id, 80) ?? randomUUID();
		const title = cleanString(input.plan.title, 120) ?? "My route";
		const visibility =
			input.plan.visibility === "unlisted" ? "unlisted" : "private";
		const shareToken = visibility === "unlisted" ? createShareToken() : null;
		const existingRows = await this.sql<{ owner_key: string }[]>`
			SELECT owner_key
			FROM app_user_plans
			WHERE id = ${planId}
			LIMIT 1
		`;
		const existingOwnerKey = existingRows[0]?.owner_key;
		if (existingOwnerKey && existingOwnerKey !== ownerKey) {
			throw new Error("Plan id belongs to a different owner");
		}

		await this.sql.begin(async (transactionSql) => {
			const sql = transactionSql as unknown as Sql;
			await sql`
				INSERT INTO app_user_plans (
					id,
					user_id,
					owner_key,
					plan_date,
					title,
					visibility,
					share_token,
					updated_at
				)
				VALUES (
					${planId},
					${userId},
					${ownerKey},
					${input.plan.planDate},
					${title},
					${visibility},
					${shareToken},
					NOW()
				)
				ON CONFLICT (id)
				DO UPDATE SET
					user_id = COALESCE(EXCLUDED.user_id, app_user_plans.user_id),
					owner_key = EXCLUDED.owner_key,
					plan_date = EXCLUDED.plan_date,
					title = EXCLUDED.title,
					visibility = EXCLUDED.visibility,
					share_token = CASE
						WHEN EXCLUDED.visibility = 'unlisted'
							THEN COALESCE(app_user_plans.share_token, EXCLUDED.share_token)
						ELSE NULL
					END,
					updated_at = NOW()
				WHERE app_user_plans.owner_key = ${ownerKey}
			`;
			const ownedRows = await sql<{ id: string }[]>`
				SELECT id
				FROM app_user_plans
				WHERE id = ${planId}
					AND owner_key = ${ownerKey}
				LIMIT 1
			`;
			if (ownedRows.length === 0) {
				throw new Error("Plan id belongs to a different owner");
			}

			await sql`
				DELETE FROM app_user_plan_stops
				WHERE plan_id IN (
					SELECT id
					FROM app_user_plans
					WHERE id = ${planId}
						AND owner_key = ${ownerKey}
				)
			`;

			for (const [index, stop] of input.plan.stops.entries()) {
				const eventKey = cleanString(stop.eventKey, 220)?.toLowerCase();
				if (!eventKey) continue;
				await sql`
					INSERT INTO app_user_plan_stops (
						id,
						plan_id,
						event_key,
						stop_order,
						locked,
						arrival_time,
						departure_time,
						travel_minutes_from_previous,
						updated_at
					)
					VALUES (
						${cleanString(stop.id, 80) ?? randomUUID()},
						${planId},
						${eventKey},
						${stop.stopOrder || index + 1},
						${stop.locked ?? false},
						${cleanString(stop.arrivalTime, 12)},
						${cleanString(stop.departureTime, 12)},
						${stop.travelMinutesFromPrevious ?? null},
						NOW()
					)
				`;
			}
		});

		const plans = await this.listPlans({ ownerKey, limit: 100 });
		const plan = plans.find((candidate) => candidate.id === planId);
		if (!plan) throw new Error("Plan was not saved");
		return plan;
	}

	async deletePlan(input: { ownerKey: string; planId: string }): Promise<void> {
		await this.ready();
		const ownerKey = sanitizeOwnerKey(input.ownerKey);
		const planId = cleanString(input.planId, 80);
		if (!planId) return;
		await this.sql`
			DELETE FROM app_user_plans
			WHERE id = ${planId}
				AND owner_key = ${ownerKey}
		`;
	}
}

export const getUserPlanRepository = (): UserPlanRepository | null => {
	if (
		globalThis.__ooocFeteFinderUserPlanRepository &&
		globalThis.__ooocFeteFinderUserPlanRepository instanceof UserPlanRepository
	) {
		return globalThis.__ooocFeteFinderUserPlanRepository;
	}
	const sql = getPostgresClient();
	if (!sql) return null;
	const repository = new UserPlanRepository(sql);
	globalThis.__ooocFeteFinderUserPlanRepository = repository;
	return repository;
};
