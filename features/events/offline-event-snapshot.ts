import type { Event } from "@/features/events/types";

const DATABASE_NAME = "oooc-fete-finder";
const DATABASE_VERSION = 1;
const EVENT_SNAPSHOT_STORE = "event-snapshots";
const HOME_SNAPSHOT_KEY = "home";

export interface EventSnapshot {
	events: Event[];
	savedAt: string;
}

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
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("Unable to open offline database"));
	});

const readFromStore = <T>(database: IDBDatabase, key: string): Promise<T | null> =>
	new Promise((resolve, reject) => {
		const transaction = database.transaction(EVENT_SNAPSHOT_STORE, "readonly");
		const store = transaction.objectStore(EVENT_SNAPSHOT_STORE);
		const request = store.get(key);

		request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
		request.onerror = () =>
			reject(request.error ?? new Error("Unable to read offline event data"));
	});

const writeToStore = (
	database: IDBDatabase,
	key: string,
	value: EventSnapshot,
): Promise<void> =>
	new Promise((resolve, reject) => {
		const transaction = database.transaction(EVENT_SNAPSHOT_STORE, "readwrite");
		const store = transaction.objectStore(EVENT_SNAPSHOT_STORE);
		const request = store.put(value, key);

		request.onsuccess = () => resolve();
		request.onerror = () =>
			reject(request.error ?? new Error("Unable to write offline event data"));
	});

export const readHomeEventSnapshot = async (): Promise<EventSnapshot | null> => {
	if (!isBrowserIndexedDbAvailable()) return null;

	const database = await openDatabase();
	try {
		return await readFromStore<EventSnapshot>(database, HOME_SNAPSHOT_KEY);
	} finally {
		database.close();
	}
};

export const writeHomeEventSnapshot = async (
	events: Event[],
): Promise<EventSnapshot | null> => {
	if (!isBrowserIndexedDbAvailable() || events.length === 0) return null;

	const snapshot = {
		events,
		savedAt: new Date().toISOString(),
	};
	const database = await openDatabase();
	try {
		await writeToStore(database, HOME_SNAPSHOT_KEY, snapshot);
		return snapshot;
	} finally {
		database.close();
	}
};
