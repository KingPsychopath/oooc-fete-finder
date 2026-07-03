import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import postgres from "postgres";

const databaseUrl =
	process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/recap";
const outputPath =
	process.env.RECAP_OUTPUT_PATH ?? "tmp/recap-data/recap-data.json";

const eventWindow = {
	start: "2026-06-01T00:00:00Z",
	end: "2026-07-01T00:00:00Z",
};

const titleCase = (value) =>
	value
		.split(/\s+/)
		.filter(Boolean)
		.map((part) =>
			part.length <= 3 && part === part.toUpperCase()
				? part
				: `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`,
		)
		.join(" ");

const clean = (value) => String(value ?? "").trim();

const parseDate = (value) => {
	const [day, month, year] = clean(value).split("-").map(Number);
	if (!day || !month || !year) return null;
	return new Date(Date.UTC(year, month - 1, day));
};

const parseTimeMinutes = (value) => {
	const [hour, minute] = clean(value).split(":").map(Number);
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
	return hour * 60 + minute;
};

const increment = (map, key, by = 1) => {
	if (!key) return;
	map.set(key, (map.get(key) ?? 0) + by);
};

const topEntries = (map, limit) =>
	[...map.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([label, value]) => ({ label, value }));

const eventsCsv = await readFile("data/events.csv", "utf8");
const parsed = Papa.parse(eventsCsv, {
	header: true,
	skipEmptyLines: true,
});
if (parsed.errors.length > 0) {
	throw new Error(`Unable to parse events.csv: ${parsed.errors[0].message}`);
}

const events = parsed.data
	.map((row) => ({
		curated: clean(row.Curated),
		title: clean(row.Title),
		date: clean(row.Date),
		dateTo: clean(row["Date To"]),
		startTime: clean(row["Start Time"]),
		endTime: clean(row["End Time"]),
		hostCountry: clean(row["Host Country"]),
		location: clean(row.Location),
		area: clean(row.Area),
		price: clean(row.Price),
		categories: clean(row.Categories),
		setting: clean(row.Setting),
		eventCategory: clean(row["Event Category"]),
		eventKey: clean(row["Event Key"]),
	}))
	.filter((event) => event.title && event.eventKey);

const events2026 = events.filter((event) => event.date.endsWith("-2026"));
const genreCounts = new Map();
const areaCounts = new Map();
const categoryCounts = new Map();
const settingCounts = new Map();
const hostCountryCounts = new Map();
const dayCounts = new Map();
let freeEvents = 0;
let outdoorEvents = 0;
let lateNightEvents = 0;
let eventsWithLocation = 0;

const locationsRaw = JSON.parse(await readFile("data/event-locations.json", "utf8"));
const locationRows = Object.values(locationsRaw?.locations ?? {});

for (const event of events2026) {
	const eventDate = parseDate(event.date);
	if (eventDate) {
		increment(
			dayCounts,
			eventDate.toLocaleDateString("en-GB", {
				weekday: "short",
				day: "numeric",
				month: "short",
				timeZone: "UTC",
			}),
		);
	}
	if (/free/i.test(event.price)) freeEvents += 1;
	if (/outdoor/i.test(event.setting)) outdoorEvents += 1;
	if (event.location) eventsWithLocation += 1;
	const startMinutes = parseTimeMinutes(event.startTime);
	const endMinutes = parseTimeMinutes(event.endTime);
	if (
		(startMinutes !== null && startMinutes >= 22 * 60) ||
		(endMinutes !== null && endMinutes <= 9 * 60)
	) {
		lateNightEvents += 1;
	}
	for (const genre of event.categories.split(",").map((part) => titleCase(clean(part)))) {
		increment(genreCounts, genre);
	}
	for (const area of event.area.split(",").map((part) => clean(part))) {
		increment(areaCounts, area);
	}
	for (const category of event.eventCategory.split(",").map((part) => clean(part))) {
		increment(categoryCounts, titleCase(category));
	}
	for (const setting of event.setting.split(",").map((part) => clean(part))) {
		increment(settingCounts, titleCase(setting));
	}
	for (const country of event.hostCountry.split(",").map((part) => clean(part))) {
		increment(hostCountryCounts, country);
	}
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
	connect_timeout: 10,
	idle_timeout: 5,
	onnotice: () => {},
});

const safeQuery = async (fn, fallback = []) => {
	try {
		return await fn();
	} catch (error) {
		return { error: String(error?.message ?? error) };
	}
};

const audienceRows = await safeQuery(() => sql`
	WITH all_sessions AS (
		SELECT session_id, recorded_at
		FROM app_discovery_analytics_stats
		WHERE recorded_at >= ${eventWindow.start}
			AND recorded_at < ${eventWindow.end}
			AND session_id IS NOT NULL
		UNION ALL
		SELECT session_id, recorded_at
		FROM app_event_engagement_stats
		WHERE recorded_at >= ${eventWindow.start}
			AND recorded_at < ${eventWindow.end}
			AND session_id IS NOT NULL
		UNION ALL
		SELECT session_id, recorded_at
		FROM ticket_exchange_analytics_stats
		WHERE recorded_at >= ${eventWindow.start}
			AND recorded_at < ${eventWindow.end}
			AND session_id IS NOT NULL
	), days AS (
		SELECT
			DATE(recorded_at AT TIME ZONE 'Europe/Paris') AS day,
			COUNT(DISTINCT session_id)::int AS unique_sessions
		FROM all_sessions
		GROUP BY 1
	)
	SELECT
		COUNT(DISTINCT session_id)::int AS active_sessions,
		(SELECT MAX(unique_sessions)::int FROM days) AS busiest_day_sessions,
		(SELECT day::text FROM days ORDER BY unique_sessions DESC, day ASC LIMIT 1) AS busiest_day
	FROM all_sessions
`);

const discoverySummary = await safeQuery(() => sql`
	SELECT action_type, COUNT(*)::int AS count, COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM app_discovery_analytics_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
	GROUP BY action_type
	ORDER BY count DESC
`);

const eventEngagementSummary = await safeQuery(() => sql`
	SELECT action_type, COUNT(*)::int AS count, COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM app_event_engagement_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
	GROUP BY action_type
	ORDER BY count DESC
`);

const topSearches = await safeQuery(() => sql`
	SELECT LOWER(TRIM(search_query)) AS query, COUNT(*)::int AS count, COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM app_discovery_analytics_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
		AND action_type = 'search'
		AND NULLIF(TRIM(search_query), '') IS NOT NULL
	GROUP BY LOWER(TRIM(search_query))
	ORDER BY count DESC, query ASC
	LIMIT 16
`);

const topFilters = await safeQuery(() => sql`
	SELECT filter_group, filter_value, COUNT(*)::int AS count, COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM app_discovery_analytics_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
		AND action_type = 'filter_apply'
		AND filter_group IS NOT NULL
		AND filter_value IS NOT NULL
	GROUP BY filter_group, filter_value
	ORDER BY count DESC
	LIMIT 24
`);

const topEvents = await safeQuery(() => sql`
	SELECT
		event_key,
		COUNT(*) FILTER (WHERE action_type = 'click')::int AS opens,
		COUNT(*) FILTER (WHERE action_type = 'outbound_click')::int AS outbound_clicks,
		COUNT(*) FILTER (WHERE action_type = 'calendar_sync')::int AS calendar_saves,
		COUNT(*) FILTER (WHERE action_type = 'saved_toggle')::int AS saves,
		COUNT(*) FILTER (WHERE action_type = 'map_open')::int AS map_opens,
		COUNT(DISTINCT session_id)::int AS unique_sessions,
		COUNT(*)::int AS total_actions
	FROM app_event_engagement_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
	GROUP BY event_key
	ORDER BY total_actions DESC, unique_sessions DESC
	LIMIT 18
`);

const dailyActivity = await safeQuery(() => sql`
	WITH all_events AS (
		SELECT recorded_at, session_id FROM app_discovery_analytics_stats WHERE recorded_at >= ${eventWindow.start} AND recorded_at < ${eventWindow.end}
		UNION ALL SELECT recorded_at, session_id FROM app_event_engagement_stats WHERE recorded_at >= ${eventWindow.start} AND recorded_at < ${eventWindow.end}
		UNION ALL SELECT recorded_at, session_id FROM ticket_exchange_analytics_stats WHERE recorded_at >= ${eventWindow.start} AND recorded_at < ${eventWindow.end}
	)
	SELECT
		DATE(recorded_at AT TIME ZONE 'Europe/Paris')::text AS day,
		COUNT(*)::int AS actions,
		COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM all_events
	GROUP BY 1
	ORDER BY 1
`);

const hourlyActivity = await safeQuery(() => sql`
	WITH all_events AS (
		SELECT recorded_at, session_id FROM app_discovery_analytics_stats WHERE recorded_at >= ${eventWindow.start} AND recorded_at < ${eventWindow.end}
		UNION ALL SELECT recorded_at, session_id FROM app_event_engagement_stats WHERE recorded_at >= ${eventWindow.start} AND recorded_at < ${eventWindow.end}
		UNION ALL SELECT recorded_at, session_id FROM ticket_exchange_analytics_stats WHERE recorded_at >= ${eventWindow.start} AND recorded_at < ${eventWindow.end}
	)
	SELECT
		EXTRACT(HOUR FROM recorded_at AT TIME ZONE 'Europe/Paris')::int AS hour,
		COUNT(*)::int AS actions,
		COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM all_events
	GROUP BY 1
	ORDER BY 1
`);

const deviceBreakdown = await safeQuery(() => sql`
	SELECT
		COALESCE(NULLIF(device_class, ''), 'unknown') AS device_class,
		COUNT(DISTINCT session_id)::int AS unique_sessions,
		COUNT(*)::int AS actions
	FROM app_discovery_analytics_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
	GROUP BY 1
	ORDER BY unique_sessions DESC
`);

const nearbySignals = await safeQuery(() => sql`
	SELECT action_type, filter_group, filter_value, search_query, COUNT(*)::int AS count, COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM app_discovery_analytics_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
		AND (
			action_type = 'location_request'
			OR filter_group ILIKE '%nearby%'
			OR filter_value ILIKE '%nearby%'
			OR search_query ILIKE '%nearby%'
			OR path ILIKE '%nearby%'
		)
	GROUP BY action_type, filter_group, filter_value, search_query
	ORDER BY count DESC
	LIMIT 30
`);

const ticketExchangeSummary = await safeQuery(() => sql`
	SELECT action_type, COUNT(*)::int AS count, COUNT(DISTINCT session_id)::int AS unique_sessions
	FROM ticket_exchange_analytics_stats
	WHERE recorded_at >= ${eventWindow.start}
		AND recorded_at < ${eventWindow.end}
	GROUP BY action_type
	ORDER BY count DESC
`);

await sql.end();

const eventByKey = new Map(events2026.map((event) => [event.eventKey, event]));
const enrichedTopEvents = Array.isArray(topEvents)
	? topEvents.map((row) => {
			const event = eventByKey.get(row.event_key);
			return {
				eventKey: row.event_key,
				title: event?.title ?? row.event_key,
				area: event?.area || "Paris",
				category: event?.eventCategory || "Event",
				opens: row.opens,
				outboundClicks: row.outbound_clicks,
				calendarSaves: row.calendar_saves,
				saves: row.saves,
				mapOpens: row.map_opens,
				uniqueSessions: row.unique_sessions,
				totalActions: row.total_actions,
			};
		})
	: topEvents;

const recap = {
	generatedAt: new Date().toISOString(),
	window: eventWindow,
	catalog: {
		events: events2026.length,
		freeEvents,
		outdoorEvents,
		lateNightEvents,
		eventsWithLocation,
		mappedPlaces: locationRows.length,
		areas: areaCounts.size,
		hostCountries: hostCountryCounts.size,
		topGenres: topEntries(genreCounts, 10),
		topAreas: topEntries(areaCounts, 10),
		topCategories: topEntries(categoryCounts, 6),
		settings: topEntries(settingCounts, 4),
		days: topEntries(dayCounts, 10),
		hostCountriesTop: topEntries(hostCountryCounts, 8),
	},
	analytics: {
		audience: Array.isArray(audienceRows) ? (audienceRows[0] ?? {}) : audienceRows,
		discoverySummary,
		eventEngagementSummary,
		ticketExchangeSummary,
		topSearches,
		topFilters,
		topEvents: enrichedTopEvents,
		dailyActivity,
		hourlyActivity,
		deviceBreakdown,
		nearbySignals,
	},
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(recap, null, 2)}\n`);
console.log(`Wrote ${path.resolve(outputPath)}`);
