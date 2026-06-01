import { getEventSnapshotFreshness } from "@/features/events/components/events-offline-provider";
import {
	EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME,
	EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION,
	EVENT_SNAPSHOT_SCHEMA_NAME,
	EVENT_SNAPSHOT_SCHEMA_VERSION,
	createEventDetailSnapshot,
	createEventSnapshot,
	validateEventDetailSnapshot,
	validateEventSnapshot,
} from "@/features/events/offline-event-snapshot";
import type { Event } from "@/features/events/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseEvent: Event = {
	eventKey: "evt_offline_test",
	slug: "offline-test-event",
	id: "offline-test-event",
	name: "Offline Test Event",
	day: "saturday",
	date: "2026-06-20",
	time: "20:00",
	endTime: "23:00",
	arrondissement: 11,
	location: "Paris",
	link: "https://example.com",
	description: "Test event",
	type: "Fete",
	genre: ["Jazz"],
	venueTypes: ["indoor"],
	indoor: true,
};

describe("offline event snapshots", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("creates versioned metadata for saved home event snapshots", () => {
		const snapshot = createEventSnapshot([baseEvent]);

		expect(snapshot.savedAt).toBe("2026-05-09T12:00:00.000Z");
		expect(snapshot.metadata).toEqual({
			eventCount: 1,
			schemaName: EVENT_SNAPSHOT_SCHEMA_NAME,
			schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION,
		});
	});

	it("accepts a valid current-schema snapshot", () => {
		const snapshot = createEventSnapshot([baseEvent]);

		expect(validateEventSnapshot(snapshot)).toEqual(snapshot);
	});

	it("rejects snapshots with a mismatched schema name", () => {
		const snapshot = {
			...createEventSnapshot([baseEvent]),
			metadata: {
				eventCount: 1,
				schemaName: "legacy-home-events",
				schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION,
			},
		};

		expect(validateEventSnapshot(snapshot)).toBeNull();
	});

	it("rejects snapshots with a mismatched schema version", () => {
		const snapshot = {
			...createEventSnapshot([baseEvent]),
			metadata: {
				eventCount: 1,
				schemaName: EVENT_SNAPSHOT_SCHEMA_NAME,
				schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION + 1,
			},
		};

		expect(validateEventSnapshot(snapshot)).toBeNull();
	});

	it("rejects invalid saved event payloads", () => {
		const invalidSnapshot = {
			events: [{ eventKey: "evt_missing_required_fields" }],
			metadata: {
				eventCount: 1,
				schemaName: EVENT_SNAPSHOT_SCHEMA_NAME,
				schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION,
			},
			savedAt: "2026-05-09T12:00:00.000Z",
		};

		expect(validateEventSnapshot(invalidSnapshot)).toBeNull();
	});

	it("rejects snapshots with inconsistent event counts", () => {
		const snapshot = {
			...createEventSnapshot([baseEvent]),
			metadata: {
				eventCount: 2,
				schemaName: EVENT_SNAPSHOT_SCHEMA_NAME,
				schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION,
			},
		};

		expect(validateEventSnapshot(snapshot)).toBeNull();
	});

	it("classifies saved snapshots from the last day as fresh", () => {
		expect(getEventSnapshotFreshness("2026-05-08T12:00:01.000Z")).toBe("fresh");
	});

	it("classifies older or invalid saved timestamps as stale", () => {
		expect(getEventSnapshotFreshness("2026-05-08T11:59:59.000Z")).toBe("stale");
		expect(getEventSnapshotFreshness("not-a-date")).toBe("stale");
	});

	it("creates versioned metadata for saved event detail snapshots", () => {
		const snapshot = createEventDetailSnapshot(baseEvent);

		expect(snapshot.savedAt).toBe("2026-05-09T12:00:00.000Z");
		expect(snapshot.metadata).toEqual({
			eventKey: baseEvent.eventKey,
			schemaName: EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME,
			schemaVersion: EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION,
		});
	});

	it("accepts a valid current-schema event detail snapshot", () => {
		const snapshot = createEventDetailSnapshot(baseEvent);

		expect(validateEventDetailSnapshot(snapshot, baseEvent.eventKey)).toEqual(
			snapshot,
		);
	});

	it("rejects event detail snapshots with mismatched schema metadata", () => {
		const snapshot = {
			...createEventDetailSnapshot(baseEvent),
			metadata: {
				eventKey: baseEvent.eventKey,
				schemaName: "legacy-event-detail",
				schemaVersion: EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION,
			},
		};

		expect(
			validateEventDetailSnapshot(snapshot, baseEvent.eventKey),
		).toBeNull();
	});

	it("rejects event detail snapshots for a different event key", () => {
		const snapshot = createEventDetailSnapshot(baseEvent);

		expect(validateEventDetailSnapshot(snapshot, "evt_other_event")).toBeNull();
	});

	it("rejects event detail snapshots whose metadata does not match the payload", () => {
		const snapshot = {
			...createEventDetailSnapshot(baseEvent),
			metadata: {
				eventKey: "evt_other_event",
				schemaName: EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME,
				schemaVersion: EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION,
			},
		};

		expect(
			validateEventDetailSnapshot(snapshot, baseEvent.eventKey),
		).toBeNull();
	});
});
