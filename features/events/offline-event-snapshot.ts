import type { Event } from "@/features/events/types";

const DATABASE_NAME = "oooc-fete-finder";
const DATABASE_VERSION = 2;
const EVENT_SNAPSHOT_STORE = "event-snapshots";
const EVENT_DETAIL_SNAPSHOT_STORE = "event-detail-snapshots";
const HOME_SNAPSHOT_KEY = "home";
export const EVENT_SNAPSHOT_SCHEMA_NAME = "home-events";
export const EVENT_SNAPSHOT_SCHEMA_VERSION = 1;
export const EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME = "event-detail";
export const EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION = 1;

export interface EventSnapshot {
	events: Event[];
	metadata: {
		eventCount: number;
		schemaName: typeof EVENT_SNAPSHOT_SCHEMA_NAME;
		schemaVersion: typeof EVENT_SNAPSHOT_SCHEMA_VERSION;
	};
	savedAt: string;
}

export interface EventDetailSnapshot {
	event: Event;
	metadata: {
		eventKey: string;
		schemaName: typeof EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME;
		schemaVersion: typeof EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION;
	};
	savedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const isEventPayload = (value: unknown): value is Event =>
	isRecord(value) &&
	typeof value.eventKey === "string" &&
	typeof value.id === "string" &&
	typeof value.name === "string";

export const validateEventSnapshot = (value: unknown): EventSnapshot | null => {
	if (!isRecord(value)) return null;
	if (typeof value.savedAt !== "string") return null;
	if (Number.isNaN(new Date(value.savedAt).getTime())) return null;
	if (!Array.isArray(value.events) || !value.events.every(isEventPayload)) {
		return null;
	}
	if (!isRecord(value.metadata)) return null;
	if (value.metadata.schemaName !== EVENT_SNAPSHOT_SCHEMA_NAME) return null;
	if (value.metadata.schemaVersion !== EVENT_SNAPSHOT_SCHEMA_VERSION) {
		return null;
	}
	if (value.metadata.eventCount !== value.events.length) return null;

	return {
		events: value.events,
		metadata: {
			eventCount: value.metadata.eventCount,
			schemaName: EVENT_SNAPSHOT_SCHEMA_NAME,
			schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION,
		},
		savedAt: value.savedAt,
	};
};

export const validateEventDetailSnapshot = (
	value: unknown,
	eventKey?: string,
): EventDetailSnapshot | null => {
	if (!isRecord(value)) return null;
	if (typeof value.savedAt !== "string") return null;
	if (Number.isNaN(new Date(value.savedAt).getTime())) return null;
	if (!isEventPayload(value.event)) return null;
	if (!isRecord(value.metadata)) return null;
	if (value.metadata.schemaName !== EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME) {
		return null;
	}
	if (value.metadata.schemaVersion !== EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION) {
		return null;
	}
	if (typeof value.metadata.eventKey !== "string") return null;
	if (
		value.metadata.eventKey.toLowerCase() !== value.event.eventKey.toLowerCase()
	) {
		return null;
	}
	if (
		eventKey &&
		value.metadata.eventKey.toLowerCase() !== eventKey.trim().toLowerCase()
	) {
		return null;
	}

	return {
		event: value.event,
		metadata: {
			eventKey: value.metadata.eventKey,
			schemaName: EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME,
			schemaVersion: EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION,
		},
		savedAt: value.savedAt,
	};
};

export const createEventSnapshot = (events: Event[]): EventSnapshot => ({
	events,
	metadata: {
		eventCount: events.length,
		schemaName: EVENT_SNAPSHOT_SCHEMA_NAME,
		schemaVersion: EVENT_SNAPSHOT_SCHEMA_VERSION,
	},
	savedAt: new Date().toISOString(),
});

export const createEventDetailSnapshot = (
	event: Event,
): EventDetailSnapshot => ({
	event,
	metadata: {
		eventKey: event.eventKey,
		schemaName: EVENT_DETAIL_SNAPSHOT_SCHEMA_NAME,
		schemaVersion: EVENT_DETAIL_SNAPSHOT_SCHEMA_VERSION,
	},
	savedAt: new Date().toISOString(),
});

const isBrowserIndexedDbAvailable = () =>
	typeof window !== "undefined" && "indexedDB" in window;

const openDatabase = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(EVENT_SNAPSHOT_STORE)) {
				database.createObjectStore(EVENT_SNAPSHOT_STORE);
			}
			if (!database.objectStoreNames.contains(EVENT_DETAIL_SNAPSHOT_STORE)) {
				database.createObjectStore(EVENT_DETAIL_SNAPSHOT_STORE);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Unable to open offline database"));
	});

const readFromStore = <T>(
	database: IDBDatabase,
	storeName: string,
	key: string,
): Promise<T | null> =>
	new Promise((resolve, reject) => {
		const transaction = database.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		const request = store.get(key);

		request.onsuccess = () =>
			resolve((request.result as T | undefined) ?? null);
		request.onerror = () =>
			reject(request.error ?? new Error("Unable to read offline event data"));
	});

const writeToStore = (
	database: IDBDatabase,
	storeName: string,
	key: string,
	value: EventSnapshot | EventDetailSnapshot,
): Promise<void> =>
	new Promise((resolve, reject) => {
		const transaction = database.transaction(storeName, "readwrite");
		const store = transaction.objectStore(storeName);
		const request = store.put(value, key);

		request.onsuccess = () => resolve();
		request.onerror = () =>
			reject(request.error ?? new Error("Unable to write offline event data"));
	});

export const readHomeEventSnapshot =
	async (): Promise<EventSnapshot | null> => {
		if (!isBrowserIndexedDbAvailable()) return null;

		const database = await openDatabase();
		try {
			const snapshot = await readFromStore<unknown>(
				database,
				EVENT_SNAPSHOT_STORE,
				HOME_SNAPSHOT_KEY,
			);
			return validateEventSnapshot(snapshot);
		} finally {
			database.close();
		}
	};

export const writeHomeEventSnapshot = async (
	events: Event[],
): Promise<EventSnapshot | null> => {
	if (!isBrowserIndexedDbAvailable() || events.length === 0) return null;

	const snapshot = createEventSnapshot(events);
	const database = await openDatabase();
	try {
		await writeToStore(
			database,
			EVENT_SNAPSHOT_STORE,
			HOME_SNAPSHOT_KEY,
			snapshot,
		);
		return snapshot;
	} finally {
		database.close();
	}
};

export const readEventDetailSnapshot = async (
	eventKey: string,
): Promise<EventDetailSnapshot | null> => {
	if (!isBrowserIndexedDbAvailable()) return null;

	const normalizedEventKey = eventKey.trim().toLowerCase();
	if (!normalizedEventKey) return null;

	const database = await openDatabase();
	try {
		const snapshot = await readFromStore<unknown>(
			database,
			EVENT_DETAIL_SNAPSHOT_STORE,
			normalizedEventKey,
		);
		return validateEventDetailSnapshot(snapshot, normalizedEventKey);
	} finally {
		database.close();
	}
};

export const writeEventDetailSnapshot = async (
	event: Event,
): Promise<EventDetailSnapshot | null> => {
	if (!isBrowserIndexedDbAvailable()) return null;

	const normalizedEventKey = event.eventKey.trim().toLowerCase();
	if (!normalizedEventKey) return null;

	const snapshot = createEventDetailSnapshot(event);
	const database = await openDatabase();
	try {
		await writeToStore(
			database,
			EVENT_DETAIL_SNAPSHOT_STORE,
			normalizedEventKey,
			snapshot,
		);
		return snapshot;
	} finally {
		database.close();
	}
};
