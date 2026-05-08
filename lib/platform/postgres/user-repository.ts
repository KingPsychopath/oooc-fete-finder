import "server-only";

import { generateUserId, isValidUserId } from "@/features/auth/user-id";
import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderUserRepository: UserRepository | undefined;
}

export interface CanonicalUserInput {
	email: string;
	firstName: string;
	lastName: string;
	source: string;
	privacyConsent: boolean;
	deviceClass?: string | null;
	platform?: string | null;
	browserFamily?: string | null;
	timezone?: string | null;
	locale?: string | null;
	timestamp?: string;
}

export interface CanonicalUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	status: string;
}

type UserRow = {
	id: string;
	email_normalized: string;
	first_name: string;
	last_name: string;
	status: string;
};

const PRIVACY_VERSION = "2026-05-08";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toSafeIsoTimestamp = (value?: string): string => {
	if (!value) return new Date().toISOString();
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
	return parsed.toISOString();
};

const toCanonicalUser = (row: UserRow): CanonicalUser => ({
	id: row.id,
	email: row.email_normalized,
	firstName: row.first_name,
	lastName: row.last_name,
	status: row.status,
});

export class UserRepository {
	private readonly sql: Sql;
	private readonly ensureSchemaPromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureSchemaPromise = this.ensureSchema();
	}

	private async ensureSchema(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_users (
				id TEXT PRIMARY KEY,
				email_normalized TEXT NOT NULL UNIQUE,
				email_display TEXT NOT NULL,
				first_name TEXT NOT NULL DEFAULT '',
				last_name TEXT NOT NULL DEFAULT '',
				status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'deleted', 'blocked')),
				source TEXT NOT NULL DEFAULT 'unknown',
				marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
				marketing_consent_at TIMESTAMPTZ,
				event_update_consent BOOLEAN NOT NULL DEFAULT FALSE,
				event_update_consent_at TIMESTAMPTZ,
				privacy_accepted_at TIMESTAMPTZ,
				privacy_version TEXT NOT NULL DEFAULT '2026-05-08',
				email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
				last_device_class TEXT,
				last_platform TEXT,
				last_browser_family TEXT,
				last_timezone TEXT,
				last_locale TEXT,
				unsubscribe_token TEXT NOT NULL UNIQUE,
				first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				last_authenticated_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;

		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_device_class TEXT`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_platform TEXT`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_browser_family TEXT`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_timezone TEXT`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_locale TEXT`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_auth_identities (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
				provider TEXT NOT NULL,
				provider_account_id TEXT NOT NULL,
				email_at_provider TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE (provider, provider_account_id)
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_auth_identities_user
			ON app_user_auth_identities (user_id, provider)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureSchemaPromise;
	}

	async ensureReady(): Promise<void> {
		await this.ready();
	}

	async upsertFromEmail(input: CanonicalUserInput): Promise<CanonicalUser> {
		await this.ready();
		const email = normalizeEmail(input.email);
		const timestamp = toSafeIsoTimestamp(input.timestamp);
		const privacyConsent = Boolean(input.privacyConsent);
		const rows = await this.sql<UserRow[]>`
			INSERT INTO app_users (
				id,
				email_normalized,
				email_display,
				first_name,
				last_name,
				source,
				event_update_consent,
				event_update_consent_at,
				privacy_accepted_at,
				privacy_version,
				last_device_class,
				last_platform,
				last_browser_family,
				last_timezone,
				last_locale,
				unsubscribe_token,
				first_seen_at,
				last_seen_at,
				last_authenticated_at,
				updated_at
			)
			VALUES (
				${generateUserId()},
				${email},
				${input.email.trim()},
				${input.firstName.trim()},
				${input.lastName.trim()},
				${input.source.trim() || "fete-finder-auth"},
				${privacyConsent},
				${privacyConsent ? timestamp : null},
				${privacyConsent ? timestamp : null},
				${PRIVACY_VERSION},
				${input.deviceClass ?? null},
				${input.platform ?? null},
				${input.browserFamily ?? null},
				${input.timezone ?? null},
				${input.locale ?? null},
				${generateUserId()},
				${timestamp},
				${timestamp},
				${timestamp},
				NOW()
			)
			ON CONFLICT (email_normalized)
			DO UPDATE SET
				email_display = EXCLUDED.email_display,
				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				source = EXCLUDED.source,
				event_update_consent = app_users.event_update_consent OR EXCLUDED.event_update_consent,
				event_update_consent_at = COALESCE(app_users.event_update_consent_at, EXCLUDED.event_update_consent_at),
				privacy_accepted_at = COALESCE(app_users.privacy_accepted_at, EXCLUDED.privacy_accepted_at),
				privacy_version = EXCLUDED.privacy_version,
				last_device_class = COALESCE(EXCLUDED.last_device_class, app_users.last_device_class),
				last_platform = COALESCE(EXCLUDED.last_platform, app_users.last_platform),
				last_browser_family = COALESCE(EXCLUDED.last_browser_family, app_users.last_browser_family),
				last_timezone = COALESCE(EXCLUDED.last_timezone, app_users.last_timezone),
				last_locale = COALESCE(EXCLUDED.last_locale, app_users.last_locale),
				last_seen_at = EXCLUDED.last_seen_at,
				last_authenticated_at = EXCLUDED.last_authenticated_at,
				updated_at = NOW()
			RETURNING
				id,
				email_normalized,
				first_name,
				last_name,
				status
		`;

		const user = rows[0];
		if (!user || !isValidUserId(user.id)) {
			throw new Error("Failed to resolve canonical user id");
		}

		await this.upsertEmailIdentity(user.id, email);
		return toCanonicalUser(user);
	}

	async getByEmail(email: string): Promise<CanonicalUser | null> {
		await this.ready();
		const rows = await this.sql<UserRow[]>`
			SELECT
				id,
				email_normalized,
				first_name,
				last_name,
				status
			FROM app_users
			WHERE email_normalized = ${normalizeEmail(email)}
			LIMIT 1
		`;
		const row = rows[0];
		return row ? toCanonicalUser(row) : null;
	}

	async touchContext(input: {
		userId?: string | null;
		email?: string | null;
		deviceClass?: string | null;
		platform?: string | null;
		browserFamily?: string | null;
		timezone?: string | null;
		locale?: string | null;
	}): Promise<void> {
		await this.ready();
		const userId = isValidUserId(input.userId) ? input.userId : null;
		const email = input.email ? normalizeEmail(input.email) : null;
		if (!userId && !email) return;

		if (userId) {
			await this.sql`
				UPDATE app_users
				SET
					last_device_class = COALESCE(${input.deviceClass ?? null}, last_device_class),
					last_platform = COALESCE(${input.platform ?? null}, last_platform),
					last_browser_family = COALESCE(${input.browserFamily ?? null}, last_browser_family),
					last_timezone = COALESCE(${input.timezone ?? null}, last_timezone),
					last_locale = COALESCE(${input.locale ?? null}, last_locale),
					last_seen_at = NOW(),
					updated_at = NOW()
				WHERE id = ${userId}
			`;
			return;
		}

		await this.sql`
			UPDATE app_users
			SET
				last_device_class = COALESCE(${input.deviceClass ?? null}, last_device_class),
				last_platform = COALESCE(${input.platform ?? null}, last_platform),
				last_browser_family = COALESCE(${input.browserFamily ?? null}, last_browser_family),
				last_timezone = COALESCE(${input.timezone ?? null}, last_timezone),
				last_locale = COALESCE(${input.locale ?? null}, last_locale),
				last_seen_at = NOW(),
				updated_at = NOW()
			WHERE email_normalized = ${email}
		`;
	}

	private async upsertEmailIdentity(
		userId: string,
		email: string,
	): Promise<void> {
		await this.sql`
			INSERT INTO app_user_auth_identities (
				id,
				user_id,
				provider,
				provider_account_id,
				email_at_provider,
				last_used_at
			)
			VALUES (
				${generateUserId()},
				${userId},
				'email',
				${email},
				${email},
				NOW()
			)
			ON CONFLICT (provider, provider_account_id)
			DO UPDATE SET
				user_id = EXCLUDED.user_id,
				email_at_provider = EXCLUDED.email_at_provider,
				last_used_at = NOW()
		`;
	}
}

export const getUserRepository = (): UserRepository | null => {
	if (
		globalThis.__ooocFeteFinderUserRepository &&
		globalThis.__ooocFeteFinderUserRepository instanceof UserRepository
	) {
		return globalThis.__ooocFeteFinderUserRepository;
	}

	const sql = getPostgresClient();
	if (!sql) return null;

	const repository = new UserRepository(sql);
	globalThis.__ooocFeteFinderUserRepository = repository;
	return repository;
};
