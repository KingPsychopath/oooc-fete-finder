import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const USER_ID_PATTERN =
	"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

const parsePositiveInt = (value, fallback) => {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(parsed) || parsed < 0) return fallback;
	return parsed;
};

const DRIFT_LOOKBACK_DAYS = parsePositiveInt(
	process.env.USER_ID_DRIFT_LOOKBACK_DAYS,
	30,
);
const ALLOWED_RECENT_MISSING_WITH_EMAIL = parsePositiveInt(
	process.env.USER_ID_DRIFT_ALLOWED_MISSING_WITH_EMAIL,
	0,
);
const ALLOWED_RECENT_MALFORMED_IDS = parsePositiveInt(
	process.env.USER_ID_DRIFT_ALLOWED_MALFORMED_IDS,
	0,
);

if (!databaseUrl) {
	console.error("Missing DATABASE_URL (or POSTGRES_URL)");
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
	onnotice: () => {},
});

const safePercent = (part, total) => {
	const safeTotal = Number(total);
	if (!Number.isFinite(safeTotal) || safeTotal <= 0) return "0.00";
	return ((Number(part) / safeTotal) * 100).toFixed(2);
};

const getEventEngagementStats = async () => {
	const rows = await sql`
		SELECT
			COUNT(*)::int AS total_rows,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NOT NULL AND stats.user_id <> '' AND stats.user_id ~* ${USER_ID_PATTERN})
			)::int AS rows_with_user_id,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
			)::int AS rows_missing_user_id,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(stats.user_email), ''), '') <> ''
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_missing_with_email,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(stats.user_email), ''), '') = ''
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_missing_without_email,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(stats.user_email), ''), '') <> ''
					AND users.id IS NOT NULL
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_recoverable_with_email,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NOT NULL AND stats.user_id <> '')
					AND NOT (stats.user_id ~* ${USER_ID_PATTERN})
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_malformed_user_id
		FROM app_event_engagement_stats stats
		LEFT JOIN app_users users
			ON users.email_normalized = lower(NULLIF(BTRIM(stats.user_email), ''))
	`;
	return rows[0];
};

const getDiscoveryStats = async () => {
	const rows = await sql`
		SELECT
			COUNT(*)::int AS total_rows,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NOT NULL AND stats.user_id <> '' AND stats.user_id ~* ${USER_ID_PATTERN})
			)::int AS rows_with_user_id,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
			)::int AS rows_missing_user_id,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(stats.user_email), ''), '') <> ''
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_missing_with_email,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(stats.user_email), ''), '') = ''
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_missing_without_email,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(stats.user_email), ''), '') <> ''
					AND users.id IS NOT NULL
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_recoverable_with_email,
			COUNT(*) FILTER (
				WHERE (stats.user_id IS NOT NULL AND stats.user_id <> '')
					AND NOT (stats.user_id ~* ${USER_ID_PATTERN})
					AND stats.recorded_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_malformed_user_id
		FROM app_discovery_analytics_stats stats
		LEFT JOIN app_users users
			ON users.email_normalized = lower(NULLIF(BTRIM(stats.user_email), ''))
	`;
	return rows[0];
};

const getGenrePreferenceStats = async () => {
	const rows = await sql`
		SELECT
			COUNT(*)::int AS total_rows,
			COUNT(*) FILTER (
				WHERE (prefs.user_id IS NOT NULL AND prefs.user_id <> '' AND prefs.user_id ~* ${USER_ID_PATTERN})
			)::int AS rows_with_user_id,
			COUNT(*) FILTER (
				WHERE (prefs.user_id IS NULL OR prefs.user_id = '' OR NOT (prefs.user_id ~* ${USER_ID_PATTERN}))
			)::int AS rows_missing_user_id,
			COUNT(*) FILTER (
				WHERE (prefs.user_id IS NULL OR prefs.user_id = '' OR NOT (prefs.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(prefs.email), ''), '') <> ''
					AND prefs.last_seen_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_missing_with_email,
			COUNT(*) FILTER (
				WHERE (prefs.user_id IS NULL OR prefs.user_id = '' OR NOT (prefs.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(prefs.email), ''), '') = ''
					AND prefs.last_seen_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_missing_without_email,
			COUNT(*) FILTER (
				WHERE (prefs.user_id IS NULL OR prefs.user_id = '' OR NOT (prefs.user_id ~* ${USER_ID_PATTERN}))
					AND COALESCE(NULLIF(BTRIM(prefs.email), ''), '') <> ''
					AND users.id IS NOT NULL
					AND prefs.last_seen_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_recoverable_with_email,
			COUNT(*) FILTER (
				WHERE (prefs.user_id IS NOT NULL AND prefs.user_id <> '')
					AND NOT (prefs.user_id ~* ${USER_ID_PATTERN})
					AND prefs.last_seen_at >= NOW() - (${DRIFT_LOOKBACK_DAYS} * INTERVAL '1 day')
			)::int AS recent_malformed_user_id
		FROM app_user_genre_preferences prefs
		LEFT JOIN app_users users
			ON users.email_normalized = lower(NULLIF(BTRIM(prefs.email), ''))
	`;
	return rows[0];
};

const summarize = (name, stats) => {
	const total = Number(stats.total_rows ?? 0);
	const withUserId = Number(stats.rows_with_user_id ?? 0);
	const missing = Number(stats.rows_missing_user_id ?? 0);
	const recentMissingWithEmail = Number(stats.recent_missing_with_email ?? 0);
	const recentMissingWithoutEmail = Number(
		stats.recent_missing_without_email ?? 0,
	);
	const recentRecoverable = Number(stats.recent_recoverable_with_email ?? 0);
	const recentMalformed = Number(stats.recent_malformed_user_id ?? 0);

	console.log(`\n${name}`);
	console.log(
		`- total: ${total}, with canonical userId: ${withUserId}, missing: ${missing} (${safePercent(missing, total)}%)`,
	);
	console.log(
		`- last ${DRIFT_LOOKBACK_DAYS}d with email (recoverability): missing=${recentMissingWithEmail}, recoverable=${recentRecoverable}, unrecoverable=${Math.max(0, recentMissingWithEmail - recentRecoverable)}`,
	);
	console.log(
		`- last ${DRIFT_LOOKBACK_DAYS}d email-less/intentional anonymous: ${recentMissingWithoutEmail}`,
	);
	console.log(`- last ${DRIFT_LOOKBACK_DAYS}d malformed userId: ${recentMalformed}`);
};

const main = async () => {
	const checks = [
		{
			name: "app_event_engagement_stats",
			getStats: getEventEngagementStats,
		},
		{
			name: "app_discovery_analytics_stats",
			getStats: getDiscoveryStats,
		},
		{
			name: "app_user_genre_preferences",
			getStats: getGenrePreferenceStats,
		},
	];

	let hasFailure = false;
	console.log(
		`Checking userId drift for canonical identity (lookback: ${DRIFT_LOOKBACK_DAYS} day(s), allowed missing-with-email: ${ALLOWED_RECENT_MISSING_WITH_EMAIL}, allowed malformed: ${ALLOWED_RECENT_MALFORMED_IDS})`,
	);
	for (const check of checks) {
		let stats;
		try {
			stats = await check.getStats();
		} catch (error) {
			console.error(`Failed ${check.name}:`, error instanceof Error ? error.message : String(error));
			hasFailure = true;
			continue;
		}
		summarize(check.name, stats);

		const recentMissingWithEmail = Number(stats.recent_missing_with_email ?? 0);
		const recentMalformed = Number(stats.recent_malformed_user_id ?? 0);
		if (
			recentMissingWithEmail > ALLOWED_RECENT_MISSING_WITH_EMAIL ||
			recentMalformed > ALLOWED_RECENT_MALFORMED_IDS
		) {
			console.log(`- status: fail (possible new drift or unmapped auth writes)`);
			hasFailure = true;
		} else {
			console.log(`- status: pass`);
		}
	}

	if (hasFailure) {
		console.log(
			"\nIdentity drift check failed: one or more tables still have recent canonical-id misses needing remediation.",
		);
		process.exitCode = 1;
		return;
	}

	console.log(
		"\nIdentity drift check passed: no recent canonical-id misses or malformed ids above allowance.",
	);
};

main()
	.catch((error) => {
		console.error(
			"Identity drift check failed:",
			error instanceof Error ? error.message : String(error),
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await sql.end({ timeout: 5 });
	});
