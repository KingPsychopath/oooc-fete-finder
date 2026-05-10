import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const USER_ID_PATTERN =
	"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

const args = process.argv.slice(2);
const hasArg = (name) => args.includes(name);
const getArg = (name, fallback = undefined) => {
	const prefixed = `${name}=`;
	for (const arg of args) {
		if (!arg.startsWith(prefixed)) continue;
		return arg.slice(prefixed.length);
	}
	return fallback;
};

const parsePositiveInt = (value, fallback) => {
	const parsed = Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return parsed;
};

if (!databaseUrl) {
	console.error("Missing DATABASE_URL (or POSTGRES_URL)");
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
	onnotice: () => {},
});

const DRY_RUN = hasArg("--dry-run");
const CLEAR_USER_EMAIL = hasArg("--clear-user-email");
const SESSION_LOOKBACK_DAYS = parsePositiveInt(
	getArg("--session-window-days", process.env.USER_ID_SESSION_LOOKBACK_DAYS),
	30,
);

const requestedTables = getArg("--tables", "")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

const availableTables = [
	"app_event_engagement_stats",
	"app_discovery_analytics_stats",
	"app_user_genre_preferences",
];

const tablesToRun =
	requestedTables.length > 0 ? requestedTables : [...availableTables];
const unknownTables = tablesToRun.filter((table) => !availableTables.includes(table));
if (unknownTables.length > 0) {
	console.error(`Unknown table(s): ${unknownTables.join(", ")}`);
	console.error(`Available: ${availableTables.join(", ")}`);
	process.exit(1);
}

const runEvent = tablesToRun.includes("app_event_engagement_stats");
const runDiscovery = tablesToRun.includes("app_discovery_analytics_stats");
const runGenre = tablesToRun.includes("app_user_genre_preferences");

const safePercent = (part, total) => {
	const safeTotal = Number(total ?? 0);
	if (!Number.isFinite(safeTotal) || safeTotal <= 0) return "0.00";
	return ((Number(part ?? 0) / safeTotal) * 100).toFixed(2);
};

const getEventCoverage = async () => {
	const rows = await sql`
		WITH missing AS (
			SELECT id, session_id, user_id, user_email
			FROM app_event_engagement_stats
			WHERE user_id IS NULL OR user_id = '' OR NOT (user_id ~* ${USER_ID_PATTERN})
		),
		session_candidates AS (
			SELECT session_id, user_id
			FROM (
				SELECT session_id, user_id
				FROM app_event_engagement_stats
				WHERE session_id IS NOT NULL
					AND session_id <> ''
					AND user_id ~* ${USER_ID_PATTERN}
					AND recorded_at >= NOW() - (${SESSION_LOOKBACK_DAYS} * INTERVAL '1 day')
				GROUP BY session_id, user_id
			) candidates
		),
		session_map AS (
			SELECT session_id, MIN(user_id) AS user_id
			FROM session_candidates
			GROUP BY session_id
			HAVING COUNT(*) = 1
		),
		recoverable_by_session AS (
			SELECT missing.id
			FROM missing
			JOIN session_map
				ON session_map.session_id = missing.session_id
		),
		recoverable_by_email AS (
			SELECT missing.id
			FROM missing
			JOIN app_users users
				ON users.email_normalized = lower(NULLIF(BTRIM(missing.user_email), ''))
			WHERE NULLIF(BTRIM(missing.user_email), '') IS NOT NULL
		),
		recoverable_union AS (
			SELECT id FROM recoverable_by_session
			UNION
			SELECT id FROM recoverable_by_email
		)
		SELECT
			(SELECT COUNT(*)::int FROM app_event_engagement_stats) AS total_rows,
			(SELECT COUNT(*) FILTER (WHERE user_id ~* ${USER_ID_PATTERN})::int FROM app_event_engagement_stats) AS canonical_user_id,
			(SELECT COUNT(*) FILTER (WHERE user_id IS NULL OR user_id = '' OR NOT (user_id ~* ${USER_ID_PATTERN}))::int FROM app_event_engagement_stats) AS missing_user_id,
			(SELECT COUNT(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> '' AND NOT (user_id ~* ${USER_ID_PATTERN}))::int FROM app_event_engagement_stats) AS malformed_user_id,
			(SELECT COUNT(*)::int FROM missing WHERE NULLIF(BTRIM(user_email), '') IS NULL) AS anonymous_or_no_email,
			(SELECT COUNT(*)::int FROM recoverable_by_session) AS recoverable_by_session,
			(SELECT COUNT(*)::int FROM recoverable_by_email) AS recoverable_by_email,
			(SELECT COUNT(*)::int FROM recoverable_union) AS recoverable_total
	`;
	return rows[0];
};

const getDiscoveryCoverage = async () => {
	const rows = await sql`
		WITH missing AS (
			SELECT id, session_id, user_id, user_email
			FROM app_discovery_analytics_stats
			WHERE user_id IS NULL OR user_id = '' OR NOT (user_id ~* ${USER_ID_PATTERN})
		),
		session_candidates AS (
			SELECT session_id, user_id
			FROM (
				SELECT session_id, user_id
				FROM app_discovery_analytics_stats
				WHERE session_id IS NOT NULL
					AND session_id <> ''
					AND user_id ~* ${USER_ID_PATTERN}
					AND recorded_at >= NOW() - (${SESSION_LOOKBACK_DAYS} * INTERVAL '1 day')
				GROUP BY session_id, user_id
			) candidates
		),
		session_map AS (
			SELECT session_id, MIN(user_id) AS user_id
			FROM session_candidates
			GROUP BY session_id
			HAVING COUNT(*) = 1
		),
		recoverable_by_session AS (
			SELECT missing.id
			FROM missing
			JOIN session_map
				ON session_map.session_id = missing.session_id
		),
		recoverable_by_email AS (
			SELECT missing.id
			FROM missing
			JOIN app_users users
				ON users.email_normalized = lower(NULLIF(BTRIM(missing.user_email), ''))
			WHERE NULLIF(BTRIM(missing.user_email), '') IS NOT NULL
		),
		recoverable_union AS (
			SELECT id FROM recoverable_by_session
			UNION
			SELECT id FROM recoverable_by_email
		)
		SELECT
			(SELECT COUNT(*)::int FROM app_discovery_analytics_stats) AS total_rows,
			(SELECT COUNT(*) FILTER (WHERE user_id ~* ${USER_ID_PATTERN})::int FROM app_discovery_analytics_stats) AS canonical_user_id,
			(SELECT COUNT(*) FILTER (WHERE user_id IS NULL OR user_id = '' OR NOT (user_id ~* ${USER_ID_PATTERN}))::int FROM app_discovery_analytics_stats) AS missing_user_id,
			(SELECT COUNT(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> '' AND NOT (user_id ~* ${USER_ID_PATTERN}))::int FROM app_discovery_analytics_stats) AS malformed_user_id,
			(SELECT COUNT(*)::int FROM missing WHERE NULLIF(BTRIM(user_email), '') IS NULL) AS anonymous_or_no_email,
			(SELECT COUNT(*)::int FROM recoverable_by_session) AS recoverable_by_session,
			(SELECT COUNT(*)::int FROM recoverable_by_email) AS recoverable_by_email,
			(SELECT COUNT(*)::int FROM recoverable_union) AS recoverable_total
	`;
	return rows[0];
};

const getGenreCoverage = async () => {
	const rows = await sql`
		WITH missing AS (
			SELECT email, user_id
			FROM app_user_genre_preferences
			WHERE user_id IS NULL OR user_id = '' OR NOT (user_id ~* ${USER_ID_PATTERN})
		),
		recoverable_by_email AS (
			SELECT missing.email
			FROM missing
			JOIN app_users users
				ON users.email_normalized = lower(NULLIF(BTRIM(missing.email), ''))
			WHERE NULLIF(BTRIM(missing.email), '') IS NOT NULL
		)
		SELECT
			(SELECT COUNT(*)::int FROM app_user_genre_preferences) AS total_rows,
			(SELECT COUNT(*) FILTER (WHERE user_id ~* ${USER_ID_PATTERN})::int FROM app_user_genre_preferences) AS canonical_user_id,
			(SELECT COUNT(*) FILTER (WHERE user_id IS NULL OR user_id = '' OR NOT (user_id ~* ${USER_ID_PATTERN}))::int FROM app_user_genre_preferences) AS missing_user_id,
			(SELECT COUNT(*) FILTER (WHERE user_id IS NOT NULL AND user_id <> '' AND NOT (user_id ~* ${USER_ID_PATTERN}))::int FROM app_user_genre_preferences) AS malformed_user_id,
			(SELECT COUNT(*)::int FROM missing WHERE NULLIF(BTRIM(email), '') IS NULL) AS anonymous_or_no_email,
			0::int AS recoverable_by_session,
			(SELECT COUNT(*)::int FROM recoverable_by_email) AS recoverable_by_email,
			(SELECT COUNT(*)::int FROM recoverable_by_email) AS recoverable_total
	`;
	return rows[0];
};

const getCoverageMap = async () => {
	const [eventCoverage, discoveryCoverage, genreCoverage] = await Promise.all([
		runEvent ? getEventCoverage() : null,
		runDiscovery ? getDiscoveryCoverage() : null,
		runGenre ? getGenreCoverage() : null,
	]);

	return {
		event: eventCoverage,
		discovery: discoveryCoverage,
		genre: genreCoverage,
	};
};

const logCoverage = (name, coverage) => {
	if (!coverage) return;
	console.log(`\n${name}`);
	console.log(
		`- total: ${coverage.total_rows}, canonical: ${coverage.canonical_user_id} (${safePercent(coverage.canonical_user_id, coverage.total_rows)}%)`,
	);
	console.log(
		`- missing canonical: ${coverage.missing_user_id} (${safePercent(coverage.missing_user_id, coverage.total_rows)}%)`,
	);
	console.log(
		`- malformed userId: ${coverage.malformed_user_id} ${coverage.malformed_user_id > 0 ? "(must be remediated)" : ""}`,
	);
	console.log(`- anonymous/no-identity bucket: ${coverage.anonymous_or_no_email}`);
	console.log(
		`- recoverable by session (<=${SESSION_LOOKBACK_DAYS}d): ${coverage.recoverable_by_session}`,
	);
	console.log(
		`- recoverable by email: ${coverage.recoverable_by_email}, recoverable total: ${coverage.recoverable_total}`,
	);
};

const attachEventBySession = async () => {
	const rows = await sql`
		WITH session_candidates AS (
			SELECT session_id, user_id
			FROM (
				SELECT session_id, user_id
				FROM app_event_engagement_stats
				WHERE session_id IS NOT NULL
					AND session_id <> ''
					AND user_id ~* ${USER_ID_PATTERN}
					AND recorded_at >= NOW() - (${SESSION_LOOKBACK_DAYS} * INTERVAL '1 day')
				GROUP BY session_id, user_id
			) candidates
		),
		session_map AS (
			SELECT session_id, MIN(user_id) AS user_id
			FROM session_candidates
			GROUP BY session_id
			HAVING COUNT(*) = 1
		)
		UPDATE app_event_engagement_stats stats
		SET user_id = session_map.user_id
		FROM session_map
		WHERE stats.session_id = session_map.session_id
			AND (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
			AND stats.recorded_at >= NOW() - (${SESSION_LOOKBACK_DAYS} * INTERVAL '1 day')
		RETURNING stats.id
	`;
	return rows.length;
};

const attachDiscoveryBySession = async () => {
	const rows = await sql`
		WITH session_candidates AS (
			SELECT session_id, user_id
			FROM (
				SELECT session_id, user_id
				FROM app_discovery_analytics_stats
				WHERE session_id IS NOT NULL
					AND session_id <> ''
					AND user_id ~* ${USER_ID_PATTERN}
					AND recorded_at >= NOW() - (${SESSION_LOOKBACK_DAYS} * INTERVAL '1 day')
				GROUP BY session_id, user_id
			) candidates
		),
		session_map AS (
			SELECT session_id, MIN(user_id) AS user_id
			FROM session_candidates
			GROUP BY session_id
			HAVING COUNT(*) = 1
		)
		UPDATE app_discovery_analytics_stats stats
		SET user_id = session_map.user_id
		FROM session_map
		WHERE stats.session_id = session_map.session_id
			AND (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
			AND stats.recorded_at >= NOW() - (${SESSION_LOOKBACK_DAYS} * INTERVAL '1 day')
		RETURNING stats.id
	`;
	return rows.length;
};

const attachEventByEmail = async () => {
	const rows = await sql`
		UPDATE app_event_engagement_stats stats
		SET user_id = users.id
		FROM app_users users
		WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
			AND NULLIF(BTRIM(stats.user_email), '') IS NOT NULL
			AND users.email_normalized = lower(NULLIF(BTRIM(stats.user_email), ''))
		RETURNING stats.id
	`;
	return rows.length;
};

const attachDiscoveryByEmail = async () => {
	const rows = await sql`
		UPDATE app_discovery_analytics_stats stats
		SET user_id = users.id
		FROM app_users users
		WHERE (stats.user_id IS NULL OR stats.user_id = '' OR NOT (stats.user_id ~* ${USER_ID_PATTERN}))
			AND NULLIF(BTRIM(stats.user_email), '') IS NOT NULL
			AND users.email_normalized = lower(NULLIF(BTRIM(stats.user_email), ''))
		RETURNING stats.id
	`;
	return rows.length;
};

const attachGenreByEmail = async () => {
	const rows = await sql`
		UPDATE app_user_genre_preferences prefs
		SET user_id = users.id
		FROM app_users users
		WHERE (prefs.user_id IS NULL OR prefs.user_id = '' OR NOT (prefs.user_id ~* ${USER_ID_PATTERN}))
			AND NULLIF(BTRIM(prefs.email), '') IS NOT NULL
			AND users.email_normalized = lower(NULLIF(BTRIM(prefs.email), ''))
		RETURNING prefs.email
	`;
	return rows.length;
};

const clearUserIdentityColumns = async () => {
	const counts = {
		event: 0,
		discovery: 0,
		genre: 0,
	};

	const eventRows = await sql`
		UPDATE app_event_engagement_stats
		SET user_email = NULL
		WHERE user_id ~* ${USER_ID_PATTERN}
			AND user_email IS NOT NULL
			AND user_email <> ''
		RETURNING id
	`;
	const discoveryRows = await sql`
		UPDATE app_discovery_analytics_stats
		SET user_email = NULL
		WHERE user_id ~* ${USER_ID_PATTERN}
			AND user_email IS NOT NULL
			AND user_email <> ''
		RETURNING id
	`;
	const genreRows = await sql`
		UPDATE app_user_genre_preferences
		SET email = NULL
		WHERE user_id ~* ${USER_ID_PATTERN}
			AND email IS NOT NULL
			AND email <> ''
		RETURNING email
	`;

	counts.event = eventRows.length;
	counts.discovery = discoveryRows.length;
	counts.genre = genreRows.length;
	return counts;
};

const showSnapshot = async () => {
	const coverage = await getCoverageMap();
	console.log("Identity coverage snapshot (all-time buckets)");
	logCoverage("app_event_engagement_stats", coverage.event);
	logCoverage("app_discovery_analytics_stats", coverage.discovery);
	logCoverage("app_user_genre_preferences", coverage.genre);
	return coverage;
};

const runBackfill = async () => {
	const before = await getCoverageMap();
	let eventSession = 0;
	let discoverySession = 0;
	let eventEmail = 0;
	let discoveryEmail = 0;
	let genreEmail = 0;

	if (runEvent) {
		eventSession = await attachEventBySession();
		eventEmail = await attachEventByEmail();
	}

	if (runDiscovery) {
		discoverySession = await attachDiscoveryBySession();
		discoveryEmail = await attachDiscoveryByEmail();
	}

	if (runGenre) {
		genreEmail = await attachGenreByEmail();
	}

	const cleared = CLEAR_USER_EMAIL ? await clearUserIdentityColumns() : null;
	const after = await getCoverageMap();
	const totalLinked = eventSession + eventEmail + discoverySession + discoveryEmail + genreEmail;

	console.log("\nBackfill run complete");
	if (runEvent) {
		console.log(
			`- app_event_engagement_stats: +${eventSession} session +${eventEmail} email (before canonical ${before.event?.canonical_user_id ?? 0}/${before.event?.total_rows ?? 0} -> after ${after.event?.canonical_user_id ?? 0}/${after.event?.total_rows ?? 0})`,
		);
	}
	if (runDiscovery) {
		console.log(
			`- app_discovery_analytics_stats: +${discoverySession} session +${discoveryEmail} email (before canonical ${before.discovery?.canonical_user_id ?? 0}/${before.discovery?.total_rows ?? 0} -> after ${after.discovery?.canonical_user_id ?? 0}/${after.discovery?.total_rows ?? 0})`,
		);
	}
	if (runGenre) {
		console.log(
			`- app_user_genre_preferences: +${genreEmail} email (before canonical ${before.genre?.canonical_user_id ?? 0}/${before.genre?.total_rows ?? 0} -> after ${after.genre?.canonical_user_id ?? 0}/${after.genre?.total_rows ?? 0})`,
		);
	}
	console.log(`- total rows linked in this pass: ${totalLinked}`);
	if (CLEAR_USER_EMAIL) {
		console.log(
			`- identity email columns cleared: event=${cleared.event}, discovery=${cleared.discovery}, genre=${cleared.genre}`,
		);
	}
};

try {
	console.log(
		`Running canonical user identity hardening on: ${tablesToRun.join(", ")} (session window: ${SESSION_LOOKBACK_DAYS}d)`,
	);
	if (DRY_RUN && CLEAR_USER_EMAIL) {
		console.log(
			"Note: --clear-user-email has no effect in --dry-run mode.",
		);
	}

	if (DRY_RUN) {
		await showSnapshot();
		console.log("\nDry-run mode: no writes applied.");
		console.log("Re-run without --dry-run to apply.");
	} else {
		await runBackfill();
		await showSnapshot();
	}
} catch (error) {
	console.error(
		"User identity backfill failed:",
		error instanceof Error ? error.message : String(error),
	);
	process.exitCode = 1;
} finally {
	await sql.end({ timeout: 5 });
}
