#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error("DATABASE_URL is required");
	process.exit(1);
}

const sql = postgres(databaseUrl, {
	prepare: false,
	max: 1,
});

const FEATURE_DURATION_HOURS = 48;
const MAX_CONCURRENT = 3;

const allocateQueue = (entries) => {
	const slots = Array.from({ length: MAX_CONCURRENT }, () => Number.NEGATIVE_INFINITY);
	return entries.map((entry) => {
		let slotIndex = 0;
		for (let index = 1; index < slots.length; index += 1) {
			if (slots[index] < slots[slotIndex]) {
				slotIndex = index;
			}
		}

		const requestedStart = new Date(entry.requested_start_at).getTime();
		const effectiveStart = Math.max(requestedStart, slots[slotIndex]);
		const effectiveEnd = effectiveStart + entry.duration_hours * 60 * 60 * 1000;
		slots[slotIndex] = effectiveEnd;

		return {
			id: entry.id,
			effectiveStartAt: new Date(effectiveStart).toISOString(),
			effectiveEndAt: new Date(effectiveEnd).toISOString(),
		};
	});
};

try {
	await sql`
		CREATE TABLE IF NOT EXISTS app_featured_event_schedule (
			id TEXT PRIMARY KEY,
			event_key TEXT NOT NULL,
			requested_start_at TIMESTAMPTZ NOT NULL,
			effective_start_at TIMESTAMPTZ NOT NULL,
			effective_end_at TIMESTAMPTZ NOT NULL,
			duration_hours INTEGER NOT NULL DEFAULT 48 CHECK (duration_hours BETWEEN 1 AND 168),
			status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
			created_by TEXT NOT NULL DEFAULT 'admin',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;

	const legacyRows = await sql`
		SELECT row_data
		FROM app_event_store_rows
		ORDER BY display_order ASC
	`;

	const legacyEventKeys = [];
	const seen = new Set();
	for (const row of legacyRows) {
		const data = row.row_data || {};
		const eventKey = String(data.eventKey || "").trim();
		const featured = String(data.featured || "").trim();
		if (!eventKey || !featured || seen.has(eventKey)) {
			continue;
		}
		seen.add(eventKey);
		legacyEventKeys.push(eventKey);
	}

	if (legacyEventKeys.length === 0) {
		console.log("No legacy featured rows found.");
		process.exit(0);
	}

	const existing = await sql`
		SELECT event_key
		FROM app_featured_event_schedule
		WHERE status = 'scheduled'
	`;
	const existingKeys = new Set(existing.map((row) => row.event_key));

	const nowIso = new Date().toISOString();
	let inserted = 0;
	for (const eventKey of legacyEventKeys) {
		if (existingKeys.has(eventKey)) continue;
		await sql`
			INSERT INTO app_featured_event_schedule (
				id,
				event_key,
				requested_start_at,
				effective_start_at,
				effective_end_at,
				duration_hours,
				status,
				created_by,
				created_at,
				updated_at
			)
			VALUES (
				${randomUUID()},
				${eventKey},
				${nowIso},
				${nowIso},
				${nowIso},
				${FEATURE_DURATION_HOURS},
				'scheduled',
				'migration-script',
				${nowIso},
				${nowIso}
			)
		`;
		inserted += 1;
	}

	const scheduled = await sql`
		SELECT id, requested_start_at, duration_hours
		FROM app_featured_event_schedule
		WHERE status = 'scheduled'
		ORDER BY requested_start_at ASC, created_at ASC, event_key ASC
	`;

	const computed = allocateQueue(scheduled);
	for (const row of computed) {
		await sql`
			UPDATE app_featured_event_schedule
			SET
				effective_start_at = ${row.effectiveStartAt},
				effective_end_at = ${row.effectiveEndAt},
				updated_at = ${nowIso}
			WHERE id = ${row.id}
		`;
	}

	console.log(
		`Seeded ${inserted} featured schedule entries from ${legacyEventKeys.length} legacy rows.`,
	);
	console.log(`Recomputed queue for ${computed.length} scheduled entries.`);
} finally {
	await sql.end({ timeout: 1 });
}
