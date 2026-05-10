import { randomBytes } from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const PRIVACY_VERSION = "2026-05-08";

if (!databaseUrl) {
	console.error("Missing DATABASE_URL (or POSTGRES_URL)");
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
	onnotice: () => {},
});

const byteToHex = Array.from({ length: 256 }, (_, index) =>
	index.toString(16).padStart(2, "0"),
);
const USER_ID_PATTERN =
	"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

const generateUserId = () => {
	const timestamp = BigInt(Date.now());
	const bytes = randomBytes(16);
	bytes[0] = Number((timestamp >> 40n) & 0xffn);
	bytes[1] = Number((timestamp >> 32n) & 0xffn);
	bytes[2] = Number((timestamp >> 24n) & 0xffn);
	bytes[3] = Number((timestamp >> 16n) & 0xffn);
	bytes[4] = Number((timestamp >> 8n) & 0xffn);
	bytes[5] = Number(timestamp & 0xffn);
	bytes[6] = (bytes[6] & 0x0f) | 0x70;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byteToHex[byte]).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const getIdentityCoverage = async () => {
	const rows = await sql`
		SELECT
			table_name,
			table_rows AS total,
			user_id_rows AS with_user_id,
			CASE
				WHEN table_rows = 0 THEN 0
				ELSE ((table_rows - user_id_rows) * 100.0 / table_rows)
			END AS missing_percentage
		FROM (
			SELECT
				'app_event_engagement_stats'::text AS table_name,
				COUNT(*)::int AS table_rows,
				COUNT(*) FILTER (
					WHERE user_id ~* ${USER_ID_PATTERN}
				)::int AS user_id_rows
			FROM app_event_engagement_stats
			UNION ALL
			SELECT
				'app_discovery_analytics_stats'::text AS table_name,
				COUNT(*)::int AS table_rows,
				COUNT(*) FILTER (
					WHERE user_id ~* ${USER_ID_PATTERN}
				)::int AS user_id_rows
			FROM app_discovery_analytics_stats
			UNION ALL
			SELECT
				'app_user_genre_preferences'::text AS table_name,
				COUNT(*)::int AS table_rows,
				COUNT(*) FILTER (
					WHERE user_id ~* ${USER_ID_PATTERN}
				)::int AS user_id_rows
			FROM app_user_genre_preferences
			UNION ALL
			SELECT
				'app_user_collection_events'::text AS table_name,
				COUNT(*)::int AS table_rows,
				COUNT(*) FILTER (
					WHERE user_id ~* ${USER_ID_PATTERN}
				)::int AS user_id_rows
			FROM app_user_collection_events
			UNION ALL
			SELECT
				'app_user_collection_rollup'::text AS table_name,
				COUNT(*)::int AS table_rows,
				COUNT(*) FILTER (
					WHERE user_id ~* ${USER_ID_PATTERN}
				)::int AS user_id_rows
			FROM app_user_collection_rollup
			UNION ALL
			SELECT
				'app_user_event_relationships'::text AS table_name,
				COUNT(*)::int AS table_rows,
				COUNT(*) FILTER (
					WHERE user_id ~* ${USER_ID_PATTERN}
				)::int AS user_id_rows
			FROM app_user_event_relationships
		) AS coverage
	`;

	return rows;
};

const logCoverage = async (prefix) => {
	const coverage = await getIdentityCoverage();
	console.log(`${prefix} identity coverage`);
	for (const row of coverage) {
		console.log(
			`- ${row.table_name}: with user_id=${row.with_user_id}/${row.total} | missing=${row.total - row.with_user_id} | missing%=${Number(
				row.missing_percentage ?? 0,
			).toFixed(2)}%`,
		);
	}
};

const ensureSchema = async () => {
	await sql`
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
			unsubscribe_token TEXT NOT NULL UNIQUE,
			first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_authenticated_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	await sql`
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

	await sql`
		CREATE TABLE IF NOT EXISTS app_user_event_relationships (
			id BIGSERIAL PRIMARY KEY,
			user_id TEXT NOT NULL,
			event_key TEXT NOT NULL,
			relationship_type TEXT NOT NULL CHECK (relationship_type IN ('saved', 'calendar_added', 'notify_me', 'dismissed')),
			source TEXT,
			notify_on_changes BOOLEAN NOT NULL DEFAULT FALSE,
			last_notified_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (user_id, event_key, relationship_type)
		)
	`;

	await sql`ALTER TABLE app_user_collection_events ADD COLUMN IF NOT EXISTS user_id TEXT`;
	await sql`ALTER TABLE app_user_collection_rollup ADD COLUMN IF NOT EXISTS user_id TEXT`;
	await sql`ALTER TABLE app_event_engagement_stats ADD COLUMN IF NOT EXISTS user_id TEXT`;
	await sql`ALTER TABLE app_discovery_analytics_stats ADD COLUMN IF NOT EXISTS user_id TEXT`;
	await sql`ALTER TABLE app_user_genre_preferences ADD COLUMN IF NOT EXISTS user_id TEXT`;

	await sql`
		CREATE INDEX IF NOT EXISTS idx_app_user_auth_identities_user
		ON app_user_auth_identities (user_id, provider)
	`;
	await sql`
		CREATE INDEX IF NOT EXISTS idx_app_user_event_relationships_event
		ON app_user_event_relationships (event_key, relationship_type, updated_at DESC)
	`;
	await sql`
		CREATE INDEX IF NOT EXISTS idx_app_user_event_relationships_user
		ON app_user_event_relationships (user_id, updated_at DESC)
	`;
};

const upsertUser = async (row) => {
	const email = row.email.trim().toLowerCase();
	const timestamp = row.first_seen_at || row.last_seen_at || new Date();
	const userRows = await sql`
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
			unsubscribe_token,
			first_seen_at,
			last_seen_at,
			last_authenticated_at,
			updated_at
		)
		VALUES (
			${generateUserId()},
			${email},
			${row.email},
			${row.first_name || ""},
			${row.last_name || ""},
			${row.source || "backfill"},
			${Boolean(row.consent)},
			${row.consent ? timestamp : null},
			${row.consent ? timestamp : null},
			${PRIVACY_VERSION},
			${generateUserId()},
			${row.first_seen_at || timestamp},
			${row.last_seen_at || timestamp},
			${row.last_seen_at || timestamp},
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
			last_seen_at = GREATEST(app_users.last_seen_at, EXCLUDED.last_seen_at),
			updated_at = NOW()
		RETURNING id
	`;
	const userId = userRows[0].id;

	await sql`
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

	return { email, userId };
};

try {
	await logCoverage("Before");
	await ensureSchema();

	console.log("Running canonical identity sweep...");

	const [unlinkedDiscoveryEmails, unlinkedGenre, unlinkedRelationships] =
		await Promise.all([
		sql`
			SELECT
				COUNT(*)::int AS total_missing_email,
				COUNT(*) FILTER (WHERE users.id IS NOT NULL)::int AS recoverable_by_email
			FROM app_discovery_analytics_stats stats
			LEFT JOIN app_users users
				ON users.email_normalized = lower(stats.user_email)
			WHERE (stats.user_id IS NULL OR stats.user_id = '')
				AND stats.user_email IS NOT NULL
				AND stats.user_email <> ''
		`,
		sql`
			SELECT
				COUNT(*)::int AS total_missing_user_id,
				COUNT(*) FILTER (WHERE users.id IS NOT NULL)::int AS recoverable_by_email
			FROM app_user_genre_preferences prefs
			LEFT JOIN app_users users
				ON users.email_normalized = lower(prefs.email)
			WHERE prefs.user_id IS NULL OR prefs.user_id = ''
			`,
			sql`
				SELECT
					COUNT(*)::int AS malformed_rows,
					COUNT(users.id) FILTER (WHERE users.id IS NOT NULL)::int AS recoverable_by_email
				FROM app_user_event_relationships relationships
				LEFT JOIN app_users users
					ON users.email_normalized = lower(relationships.user_id)
				WHERE relationships.user_id IS NOT NULL
					AND relationships.user_id <> ''
					AND NOT (relationships.user_id ~* ${USER_ID_PATTERN})
				`,
		]);

	console.log(
		`- discovery missing user_id with email: ${unlinkedDiscoveryEmails[0].total_missing_email} (recoverable ${unlinkedDiscoveryEmails[0].recoverable_by_email})`,
	);
	console.log(
		`- genre missing user_id: ${unlinkedGenre[0].total_missing_user_id} (recoverable ${unlinkedGenre[0].recoverable_by_email})`,
	);
	console.log(
		`- relationship malformed user_id: ${unlinkedRelationships[0].malformed_rows} (recoverable ${unlinkedRelationships[0].recoverable_by_email})`,
	);

	const rollupRows = await sql`
		SELECT
			email,
			first_name,
			last_name,
			consent,
			source,
			first_seen_at,
			last_seen_at
		FROM app_user_collection_rollup
		ORDER BY first_seen_at ASC
	`;

	let backfilledUsers = 0;
	for (const row of rollupRows) {
		const { email, userId } = await upsertUser(row);
		await sql`
			UPDATE app_user_collection_rollup
			SET user_id = ${userId}
			WHERE email = ${email}
				AND (user_id IS NULL OR user_id = '')
		`;
		backfilledUsers += 1;
	}

	const collectionEvents = await sql`
		UPDATE app_user_collection_events events
		SET user_id = users.id
		FROM app_users users
		WHERE events.user_id IS NULL
			AND users.email_normalized = lower(events.email)
		RETURNING events.id
	`;

	const discoveryRows = await sql`
		UPDATE app_discovery_analytics_stats stats
		SET user_id = users.id
		FROM app_users users
		WHERE stats.user_id IS NULL
			AND stats.user_email IS NOT NULL
			AND users.email_normalized = lower(stats.user_email)
		RETURNING stats.id
	`;

	const clearedDiscoveryEmails = await sql`
		UPDATE app_discovery_analytics_stats
		SET user_email = NULL
		WHERE user_id IS NOT NULL
			AND user_email IS NOT NULL
		RETURNING id
	`;

	const preferenceRows = await sql`
		UPDATE app_user_genre_preferences preferences
		SET user_id = users.id
		FROM app_users users
		WHERE preferences.user_id IS NULL
			AND users.email_normalized = lower(preferences.email)
		RETURNING preferences.email
	`;

	const eventRows = await sql`
		UPDATE app_event_engagement_stats stats
		SET user_id = users.id
		FROM app_users users
		WHERE stats.user_id IS NULL
			AND users.email_normalized = lower(stats.user_email)
		RETURNING stats.id
	`;

	const relationshipRows = await sql`
		UPDATE app_user_event_relationships relationships
		SET user_id = users.id
		FROM app_users users
		WHERE relationships.user_id IS NOT NULL
			AND relationships.user_id <> ''
			AND users.email_normalized = lower(relationships.user_id)
			AND NOT (relationships.user_id ~* ${USER_ID_PATTERN})
		RETURNING relationships.id
	`;

	const [remainingDiscoveryRows, remainingGenreRows, remainingMalformedRelationships] =
		await Promise.all([
			sql`
				SELECT
					COUNT(*)::int AS missing_user_id
				FROM app_discovery_analytics_stats stats
				WHERE stats.user_id IS NULL
					OR stats.user_id = ''
					OR NOT (stats.user_id ~* ${USER_ID_PATTERN})
			`,
			sql`
				SELECT
					COUNT(*)::int AS missing_user_id
				FROM app_user_genre_preferences
				WHERE user_id IS NULL
					OR user_id = ''
					OR NOT (user_id ~* ${USER_ID_PATTERN})
			`,
			sql`
				SELECT
					COUNT(*)::int AS malformed_user_id
				FROM app_user_event_relationships relationships
				WHERE relationships.user_id IS NOT NULL
					AND relationships.user_id <> ''
					AND NOT (relationships.user_id ~* ${USER_ID_PATTERN})
			`,
		]);

	const totals = await sql`
		SELECT COUNT(*)::int AS count
		FROM app_users
	`;

	await logCoverage("After");

	console.log("User identity backfill complete");
	console.log(`- rollup users processed: ${backfilledUsers}`);
	console.log(`- canonical users total: ${totals[0]?.count ?? 0}`);
	console.log(`- collection events linked: ${collectionEvents.length}`);
	console.log(`- discovery rows linked: ${discoveryRows.length}`);
	console.log(`- discovery row emails cleared: ${clearedDiscoveryEmails.length}`);
	console.log(`- genre preference rows linked: ${preferenceRows.length}`);
	console.log(`- event rows linked by email fallback: ${eventRows.length}`);
	console.log(`- user-event relationship rows normalized: ${relationshipRows.length}`);
	console.log(
		`- discovery rows still missing canonical user_id: ${remainingDiscoveryRows[0]?.missing_user_id ?? 0}`,
	);
	console.log(
		`- genre rows still missing canonical user_id: ${remainingGenreRows[0]?.missing_user_id ?? 0}`,
	);
	console.log(
		`- relationship rows still malformed user_id: ${remainingMalformedRelationships[0]?.malformed_user_id ?? 0}`,
	);
} finally {
	await sql.end({ timeout: 5 });
}
