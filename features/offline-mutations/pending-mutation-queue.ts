"use client";

const STORAGE_KEY = "oooc:pending-mutations:v1";
const MAX_QUEUE_ITEMS = 250;
const MAX_ATTEMPTS = 8;

export type PendingMutationType = "saved_event";

export interface SavedEventMutationPayload {
	eventKey: string;
	isSaved: boolean;
	source: string;
}

export interface PendingSavedEventMutation {
	id: string;
	type: "saved_event";
	ownerKey: string;
	payload: SavedEventMutationPayload;
	createdAt: string;
	updatedAt: string;
	attempts: number;
	nextAttemptAt: string | null;
	idempotencyKey: string;
}

export type PendingMutation = PendingSavedEventMutation;

interface FlushSavedEventMutationInput {
	mutation: PendingSavedEventMutation;
}

/*
 * Shared queue for user-visible state mutations that must survive offline mode.
 * Add new mutation types here only when there is a real product surface that can
 * create them. Current consumer: saved events.
 */

const createMutationId = (): string => {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeEventKey = (eventKey: string): string =>
	eventKey.trim().toLowerCase();

const isSavedEventMutation = (
	value: Partial<PendingMutation>,
): value is PendingSavedEventMutation => {
	const payload = value.payload as
		| Partial<SavedEventMutationPayload>
		| undefined;
	return (
		value.type === "saved_event" &&
		typeof value.id === "string" &&
		typeof value.ownerKey === "string" &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		typeof value.attempts === "number" &&
		typeof value.idempotencyKey === "string" &&
		typeof payload?.eventKey === "string" &&
		typeof payload.isSaved === "boolean" &&
		typeof payload.source === "string"
	);
};

const readQueue = (): PendingMutation[] => {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((item): item is PendingMutation =>
				isSavedEventMutation(item as Partial<PendingMutation>),
			)
			.map((item) => ({
				...item,
				payload: {
					...item.payload,
					eventKey: normalizeEventKey(item.payload.eventKey),
				},
			}))
			.filter((item) => item.payload.eventKey.length > 0)
			.slice(-MAX_QUEUE_ITEMS);
	} catch {
		window.localStorage.removeItem(STORAGE_KEY);
		return [];
	}
};

const writeQueue = (queue: PendingMutation[]) => {
	if (typeof window === "undefined") return;
	try {
		if (queue.length === 0) {
			window.localStorage.removeItem(STORAGE_KEY);
			return;
		}
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS)),
		);
	} catch {
		// Keep the current in-memory operation alive even if storage is full.
	}
};

const getSavedEventCompactionKey = (
	ownerKey: string,
	eventKey: string,
): string => `saved_event:${ownerKey}:${normalizeEventKey(eventKey)}`;

export const enqueueSavedEventMutation = (input: {
	ownerKey: string;
	eventKey: string;
	isSaved: boolean;
	source: string;
}): PendingSavedEventMutation | null => {
	const eventKey = normalizeEventKey(input.eventKey);
	const ownerKey = input.ownerKey.trim();
	if (!eventKey || !ownerKey) return null;

	const now = new Date().toISOString();
	const compactionKey = getSavedEventCompactionKey(ownerKey, eventKey);
	const queue = readQueue();
	const existingIndex = queue.findIndex(
		(item) =>
			item.type === "saved_event" &&
			getSavedEventCompactionKey(item.ownerKey, item.payload.eventKey) ===
				compactionKey,
	);
	const mutation: PendingSavedEventMutation =
		existingIndex >= 0 && queue[existingIndex].type === "saved_event"
			? {
					...queue[existingIndex],
					payload: {
						eventKey,
						isSaved: input.isSaved,
						source: input.source,
					},
					updatedAt: now,
					attempts: 0,
					nextAttemptAt: null,
				}
			: {
					id: createMutationId(),
					type: "saved_event",
					ownerKey,
					payload: {
						eventKey,
						isSaved: input.isSaved,
						source: input.source,
					},
					createdAt: now,
					updatedAt: now,
					attempts: 0,
					nextAttemptAt: null,
					idempotencyKey: compactionKey,
				};

	if (existingIndex >= 0) {
		queue[existingIndex] = mutation;
	} else {
		queue.push(mutation);
	}
	writeQueue(queue);
	return mutation;
};

const getRetryDelayMs = (attempts: number): number =>
	Math.min(5 * 60 * 1000, 1000 * 2 ** Math.max(0, attempts - 1));

const markAttemptFailed = (mutation: PendingMutation) => {
	const queue = readQueue();
	const index = queue.findIndex((item) => item.id === mutation.id);
	if (index < 0) return;
	const attempts = queue[index].attempts + 1;
	if (attempts >= MAX_ATTEMPTS) {
		queue.splice(index, 1);
		writeQueue(queue);
		return;
	}
	queue[index] = {
		...queue[index],
		attempts,
		nextAttemptAt: new Date(
			Date.now() + getRetryDelayMs(attempts),
		).toISOString(),
	};
	writeQueue(queue);
};

const markAttemptSucceeded = (mutation: PendingMutation) => {
	writeQueue(readQueue().filter((item) => item.id !== mutation.id));
};

const isReadyToFlush = (mutation: PendingMutation): boolean => {
	if (!mutation.nextAttemptAt) return true;
	return new Date(mutation.nextAttemptAt).getTime() <= Date.now();
};

export const flushPendingMutations = async (handlers: {
	savedEvent: (input: FlushSavedEventMutationInput) => Promise<boolean>;
	ownerKey?: string;
}): Promise<{ attempted: number; succeeded: number; remaining: number }> => {
	if (typeof window === "undefined") {
		return { attempted: 0, succeeded: 0, remaining: 0 };
	}

	let attempted = 0;
	let succeeded = 0;
	const queue = readQueue().filter(
		(mutation) =>
			(!handlers.ownerKey || mutation.ownerKey === handlers.ownerKey) &&
			isReadyToFlush(mutation),
	);

	for (const mutation of queue) {
		attempted += 1;
		const didSucceed =
			mutation.type === "saved_event"
				? await handlers.savedEvent({ mutation })
				: false;
		if (didSucceed) {
			succeeded += 1;
			markAttemptSucceeded(mutation);
		} else {
			markAttemptFailed(mutation);
		}
	}

	return {
		attempted,
		succeeded,
		remaining: readQueue().length,
	};
};

export const getPendingMutationCount = (ownerKey?: string): number =>
	readQueue().filter((mutation) => !ownerKey || mutation.ownerKey === ownerKey)
		.length;

export const discardPendingMutations = (ownerKey?: string): number => {
	const queue = readQueue();
	const retainedQueue = ownerKey
		? queue.filter((mutation) => mutation.ownerKey !== ownerKey)
		: [];
	const discarded = queue.length - retainedQueue.length;
	if (discarded > 0) {
		writeQueue(retainedQueue);
	}
	return discarded;
};
