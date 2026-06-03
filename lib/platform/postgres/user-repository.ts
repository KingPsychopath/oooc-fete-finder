import "server-only";

import { generateUserId, isValidUserId } from "@/features/auth/user-id";
import { legalPrivacyVersion, legalTermsVersion } from "@/lib/legal";
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
	termsAccepted: boolean;
	privacyConsent: boolean;
	marketingConsent?: boolean;
	eventUpdateConsent?: boolean;
	marketingPreferenceUpdated?: boolean;
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

type ColumnTypeRow = {
	column_type: string;
};

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
				privacy_version TEXT NOT NULL DEFAULT '2026-06-01',
				terms_accepted_at TIMESTAMPTZ,
				terms_version TEXT NOT NULL DEFAULT '2026-06-03',
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
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_normalized TEXT`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_display TEXT`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT ''`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT ''`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'unknown'`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS event_update_consent BOOLEAN NOT NULL DEFAULT FALSE`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS event_update_consent_at TIMESTAMPTZ`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS privacy_version TEXT NOT NULL DEFAULT '2026-06-01'`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS terms_version TEXT NOT NULL DEFAULT '2026-06-03'`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_authenticated_at TIMESTAMPTZ`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
		await this
			.sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
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
			DO $$
			BEGIN
				IF EXISTS (
					SELECT 1
					FROM information_schema.columns
					WHERE table_schema = 'public'
						AND table_name = 'app_users'
						AND column_name = 'email'
				) THEN
						EXECUTE $user_email_backfill$
						UPDATE app_users
						SET
							email_normalized = LOWER(NULLIF(email::text, '')),
							email_display = NULLIF(email::text, '')
						WHERE email_normalized IS NULL
							AND NULLIF(email::text, '') IS NOT NULL
						$user_email_backfill$;
				END IF;

				IF to_regclass('app_user_collection_rollup') IS NOT NULL THEN
						EXECUTE $user_rollup_backfill$
						UPDATE app_users users
						SET
							email_normalized = LOWER(rollup.email),
							email_display = rollup.email,
							first_name = COALESCE(NULLIF(users.first_name, ''), rollup.first_name, ''),
							last_name = COALESCE(NULLIF(users.last_name, ''), rollup.last_name, ''),
							source = COALESCE(NULLIF(users.source, ''), rollup.source, 'unknown'),
							event_update_consent = users.event_update_consent OR rollup.consent,
							event_update_consent_at = COALESCE(users.event_update_consent_at, rollup.last_seen_at),
							privacy_accepted_at = COALESCE(users.privacy_accepted_at, rollup.last_seen_at),
							last_seen_at = GREATEST(users.last_seen_at, rollup.last_seen_at),
							last_authenticated_at = COALESCE(users.last_authenticated_at, rollup.last_seen_at),
							updated_at = NOW()
						FROM app_user_collection_rollup rollup
						WHERE rollup.user_id = users.id
							AND users.email_normalized IS NULL
						$user_rollup_backfill$;
				END IF;
			END $$;
		`;

		await this.sql`
			UPDATE app_users
			SET email_normalized = LOWER(id::text) || '@unknown.invalid'
			WHERE email_normalized IS NULL
		`;
		await this.sql`
			UPDATE app_users
			SET email_display = email_normalized
			WHERE email_display IS NULL
		`;
		await this.sql`
			UPDATE app_users
			SET unsubscribe_token = id::text
			WHERE unsubscribe_token IS NULL
		`;
		await this.sql`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_normalized_unique
			ON app_users (email_normalized)
		`;
		await this.sql`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_unsubscribe_token_unique
			ON app_users (unsubscribe_token)
		`;

		const userIdColumnType = await this.getAppUserIdColumnType();
		await this.sql.unsafe(`
			CREATE TABLE IF NOT EXISTS app_user_auth_identities (
				id TEXT PRIMARY KEY,
				user_id ${userIdColumnType} NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
				provider TEXT NOT NULL,
				provider_account_id TEXT NOT NULL,
				email_at_provider TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE (provider, provider_account_id)
			)
		`);

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_auth_identities_user
			ON app_user_auth_identities (user_id, provider)
		`;
	}

	private async getAppUserIdColumnType(): Promise<"TEXT" | "UUID"> {
		const rows = await this.sql<ColumnTypeRow[]>`
			SELECT format_type(attribute.atttypid, attribute.atttypmod) AS column_type
			FROM pg_attribute attribute
			WHERE attribute.attrelid = 'app_users'::regclass
				AND attribute.attname = 'id'
				AND NOT attribute.attisdropped
			LIMIT 1
		`;
		return rows[0]?.column_type === "uuid" ? "UUID" : "TEXT";
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
		const termsAccepted = Boolean(input.termsAccepted);
		const privacyConsent = Boolean(input.privacyConsent);
		const marketingConsent = Boolean(input.marketingConsent);
		const eventUpdateConsent = Boolean(input.eventUpdateConsent);
		const marketingPreferenceUpdated = Boolean(
			input.marketingPreferenceUpdated,
		);
		const rows = await this.sql<UserRow[]>`
			INSERT INTO app_users (
				id,
				email_normalized,
				email_display,
				first_name,
				last_name,
				source,
				marketing_consent,
				marketing_consent_at,
				event_update_consent,
				event_update_consent_at,
				privacy_accepted_at,
				privacy_version,
				terms_accepted_at,
				terms_version,
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
				${marketingConsent},
				${marketingConsent ? timestamp : null},
				${eventUpdateConsent},
				${eventUpdateConsent ? timestamp : null},
				${privacyConsent ? timestamp : null},
				${legalPrivacyVersion},
				${termsAccepted ? timestamp : null},
				${legalTermsVersion},
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
				marketing_consent = CASE
					WHEN ${marketingPreferenceUpdated} THEN EXCLUDED.marketing_consent
					ELSE app_users.marketing_consent
				END,
				marketing_consent_at = CASE
					WHEN NOT ${marketingPreferenceUpdated} THEN app_users.marketing_consent_at
					WHEN EXCLUDED.marketing_consent THEN COALESCE(app_users.marketing_consent_at, EXCLUDED.marketing_consent_at)
					ELSE NULL
				END,
				event_update_consent = CASE
					WHEN ${marketingPreferenceUpdated} THEN EXCLUDED.event_update_consent
					ELSE app_users.event_update_consent
				END,
				event_update_consent_at = CASE
					WHEN NOT ${marketingPreferenceUpdated} THEN app_users.event_update_consent_at
					WHEN EXCLUDED.event_update_consent THEN COALESCE(app_users.event_update_consent_at, EXCLUDED.event_update_consent_at)
					ELSE NULL
				END,
				privacy_accepted_at = CASE
					WHEN EXCLUDED.privacy_accepted_at IS NULL THEN app_users.privacy_accepted_at
					WHEN app_users.privacy_version = EXCLUDED.privacy_version THEN app_users.privacy_accepted_at
					ELSE EXCLUDED.privacy_accepted_at
				END,
				privacy_version = EXCLUDED.privacy_version,
				terms_accepted_at = CASE
					WHEN EXCLUDED.terms_accepted_at IS NULL THEN app_users.terms_accepted_at
					WHEN app_users.terms_version = EXCLUDED.terms_version THEN app_users.terms_accepted_at
					ELSE EXCLUDED.terms_accepted_at
				END,
				terms_version = EXCLUDED.terms_version,
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
