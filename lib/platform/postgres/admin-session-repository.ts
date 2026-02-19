import "server-only";

import type {
	AdminSessionStatus,
	AdminTokenSessionRecord,
} from "@/features/auth/admin-auth-token";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderAdminSessionRepository:
		| AdminSessionRepository
		| undefined;
}

type SessionRow = {
	jti: string;
	tv: number;
	iat: number;
	exp: number;
	ip: string;
	ua: string;
	revoked_until: Date | string | null;
};

type SessionListCursorPayload = {
	iat: number;
	jti: string;
};

export interface SessionListCursor {
	nextCursor: string | null;
}

export interface PaginatedSessionListResult extends SessionListCursor {
	items: AdminTokenSessionRecord[];
	count: number;
	hasMore: boolean;
}

const toIsoString = (value: Date | string | null): string | null => {
	if (!value) return null;
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
};

const encodeCursor = (payload: SessionListCursorPayload): string =>
	Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");

const decodeCursor = (raw: string | null): SessionListCursorPayload | null => {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(
			Buffer.from(raw, "base64url").toString("utf-8"),
		) as Partial<SessionListCursorPayload>;
		if (
			typeof parsed.iat !== "number" ||
			!Number.isInteger(parsed.iat) ||
			typeof parsed.jti !== "string" ||
			parsed.jti.length === 0
		) {
			return null;
		}
		return {
			iat: parsed.iat,
			jti: parsed.jti,
		};
	} catch {
		return null;
	}
};

const resolveSessionStatus = (input: {
	session: SessionRow;
	currentVersion: number;
	nowSeconds: number;
}): AdminSessionStatus => {
	if (input.session.exp <= input.nowSeconds) {
		return "expired";
	}

	const revokedUntilIso = toIsoString(input.session.revoked_until);
	if (revokedUntilIso) {
		const revokedUntilSeconds = Math.floor(
			new Date(revokedUntilIso).getTime() / 1000,
		);
		if (revokedUntilSeconds > input.nowSeconds) {
			return "revoked";
		}
	}

	if (input.session.tv !== input.currentVersion) {
		return "invalidated";
	}

	return "active";
};

export class AdminSessionRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_admin_sessions (
				jti TEXT PRIMARY KEY,
				tv INTEGER NOT NULL,
				iat INTEGER NOT NULL,
				exp INTEGER NOT NULL,
				ip TEXT NOT NULL,
				ua TEXT NOT NULL,
				revoked_until TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_admin_sessions_iat_jti
			ON app_admin_sessions (iat DESC, jti DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_admin_sessions_exp
			ON app_admin_sessions (exp)
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_admin_session_meta (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async createSession(input: {
		jti: string;
		tv: number;
		iat: number;
		exp: number;
		ip: string;
		ua: string;
	}): Promise<void> {
		await this.ready();
		await this.sql`
			INSERT INTO app_admin_sessions (
				jti,
				tv,
				iat,
				exp,
				ip,
				ua,
				revoked_until,
				updated_at
			)
			VALUES (
				${input.jti},
				${input.tv},
				${input.iat},
				${input.exp},
				${input.ip},
				${input.ua},
				NULL,
				NOW()
			)
			ON CONFLICT (jti)
			DO UPDATE SET
				tv = EXCLUDED.tv,
				iat = EXCLUDED.iat,
				exp = EXCLUDED.exp,
				ip = EXCLUDED.ip,
				ua = EXCLUDED.ua,
				revoked_until = NULL,
				updated_at = NOW()
		`;
	}

	async getSessionByJti(jti: string): Promise<SessionRow | null> {
		await this.ready();
		const rows = await this.sql<SessionRow[]>`
			SELECT
				jti,
				tv,
				iat,
				exp,
				ip,
				ua,
				revoked_until
			FROM app_admin_sessions
			WHERE jti = ${jti}
			LIMIT 1
		`;
		return rows[0] ?? null;
	}

	async revokeSessionByJti(jti: string): Promise<boolean> {
		await this.ready();
		const rows = await this.sql<{ jti: string }[]>`
			UPDATE app_admin_sessions
			SET
				revoked_until = GREATEST(
					TO_TIMESTAMP(exp),
					NOW() + INTERVAL '60 seconds'
				),
				updated_at = NOW()
			WHERE jti = ${jti}
			RETURNING jti
		`;
		return rows.length > 0;
	}

	async getTokenVersion(): Promise<number> {
		await this.ready();
		const rows = await this.sql<{ value: string }[]>`
			SELECT value
			FROM app_admin_session_meta
			WHERE key = 'token_version'
			LIMIT 1
		`;
		const parsed = Number.parseInt(rows[0]?.value ?? "", 10);
		if (Number.isInteger(parsed) && parsed > 0) {
			return parsed;
		}

		await this.setTokenVersion(1);
		return 1;
	}

	async setTokenVersion(nextVersion: number): Promise<void> {
		await this.ready();
		await this.sql`
			INSERT INTO app_admin_session_meta (
				key,
				value,
				updated_at
			)
			VALUES ('token_version', ${String(nextVersion)}, NOW())
			ON CONFLICT (key)
			DO UPDATE SET
				value = EXCLUDED.value,
				updated_at = NOW()
		`;
	}

	async listSessionsPaginated(input?: {
		limit?: number;
		cursor?: string | null;
		status?: AdminSessionStatus;
		currentVersion?: number;
	}): Promise<PaginatedSessionListResult> {
		await this.ready();
		const safeLimit = Math.max(1, Math.min(input?.limit ?? 20, 100));
		const cursor = decodeCursor(input?.cursor ?? null);
		const currentVersion =
			typeof input?.currentVersion === "number" && input.currentVersion > 0
				? input.currentVersion
				: await this.getTokenVersion();
		const nowSeconds = Math.floor(Date.now() / 1000);

		const rows = await this.sql<SessionRow[]>`
			SELECT
				jti,
				tv,
				iat,
				exp,
				ip,
				ua,
				revoked_until
			FROM app_admin_sessions
			${
				cursor
					? this
							.sql`WHERE (iat < ${cursor.iat} OR (iat = ${cursor.iat} AND jti < ${cursor.jti}))`
					: this.sql``
			}
			ORDER BY iat DESC, jti DESC
			LIMIT ${safeLimit + 1}
		`;

		const mapped = rows.map((session) => ({
			jti: session.jti,
			tv: session.tv,
			iat: session.iat,
			exp: session.exp,
			ip: session.ip || "unknown",
			ua: session.ua || "unknown",
			status: resolveSessionStatus({
				session,
				currentVersion,
				nowSeconds,
			}),
		}));
		const filtered = input?.status
			? mapped.filter((session) => session.status === input.status)
			: mapped;

		const hasMore = filtered.length > safeLimit;
		const items = filtered.slice(0, safeLimit);
		const last = items[items.length - 1];
		const nextCursor =
			hasMore && last ? encodeCursor({ iat: last.iat, jti: last.jti }) : null;

		const countRows = await this.sql<{ count: number }[]>`
			SELECT COUNT(*)::int AS count
			FROM app_admin_sessions
		`;

		return {
			items,
			hasMore,
			nextCursor,
			count: countRows[0]?.count ?? 0,
		};
	}

	async cleanupExpired(graceSeconds: number): Promise<number> {
		await this.ready();
		const safeGraceSeconds = Math.max(0, Math.floor(graceSeconds));
		const cutoffSeconds = Math.floor(Date.now() / 1000) - safeGraceSeconds;
		const rows = await this.sql<{ count: number }[]>`
			WITH deleted AS (
				DELETE FROM app_admin_sessions
				WHERE exp <= ${cutoffSeconds}
				RETURNING jti
			)
			SELECT COUNT(*)::int AS count
			FROM deleted
		`;
		return rows[0]?.count ?? 0;
	}

	async clearAllSessions(): Promise<number> {
		await this.ready();
		const rows = await this.sql<{ count: number }[]>`
			WITH deleted AS (
				DELETE FROM app_admin_sessions
				RETURNING jti
			)
			SELECT COUNT(*)::int AS count
			FROM deleted
		`;
		return rows[0]?.count ?? 0;
	}
}

export const getAdminSessionRepository = (): AdminSessionRepository | null => {
	const sql = getPostgresClient();
	if (!sql) return null;

	if (!globalThis.__ooocFeteFinderAdminSessionRepository) {
		globalThis.__ooocFeteFinderAdminSessionRepository =
			new AdminSessionRepository(sql);
	}

	return globalThis.__ooocFeteFinderAdminSessionRepository;
};
