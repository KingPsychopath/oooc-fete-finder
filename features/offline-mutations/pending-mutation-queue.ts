"use client";

const STORAGE_KEY = "oooc:pending-mutations:v1";
const MAX_QUEUE_ITEMS = 250;
const MAX_ATTEMPTS = 8;
const MAX_MUTATION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface SavedEventMutationPayload {
	eventKey: string;
	isSaved: boolean;
	source: string;
}

interface PendingSavedEventMutation {
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

interface RoutePlanMutationPayload {
	planId: string;
	plan: unknown;
	source: string;
}

interface PendingRoutePlanMutation {
	id: string;
	type: "route_plan";
	ownerKey: string;
	payload: RoutePlanMutationPayload;
	createdAt: string;
	updatedAt: string;
	attempts: number;
	nextAttemptAt: string | null;
	idempotencyKey: string;
}

interface RoutePlanDeleteMutationPayload {
	planId: string;
	source: string;
}

interface PendingRoutePlanDeleteMutation {
	id: string;
	type: "route_plan_delete";
	ownerKey: string;
	payload: RoutePlanDeleteMutationPayload;
	createdAt: string;
	updatedAt: string;
	attempts: number;
	nextAttemptAt: string | null;
	idempotencyKey: string;
}

type PendingMutation =
	| PendingSavedEventMutation
	| PendingRoutePlanMutation
	| PendingRoutePlanDeleteMutation;

interface FlushSavedEventMutationInput {
	mutation: PendingSavedEventMutation;
}

interface FlushRoutePlanMutationInput {
	mutation: PendingRoutePlanMutation;
}

interface FlushRoutePlanDeleteMutationInput {
	mutation: PendingRoutePlanDeleteMutation;
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

const isRoutePlanMutation = (
	value: Partial<PendingMutation>,
): value is PendingRoutePlanMutation => {
	const payload = value.payload as
		| Partial<RoutePlanMutationPayload>
		| undefined;
	return (
		value.type === "route_plan" &&
		typeof value.id === "string" &&
		typeof value.ownerKey === "string" &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		typeof value.attempts === "number" &&
		typeof value.idempotencyKey === "string" &&
		typeof payload?.planId === "string" &&
		typeof payload.source === "string" &&
		payload.plan !== null &&
		typeof payload.plan === "object"
	);
};

const isRoutePlanDeleteMutation = (
	value: Partial<PendingMutation>,
): value is PendingRoutePlanDeleteMutation => {
	const payload = value.payload as
		| Partial<RoutePlanDeleteMutationPayload>
		| undefined;
	return (
		value.type === "route_plan_delete" &&
		typeof value.id === "string" &&
		typeof value.ownerKey === "string" &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		typeof value.attempts === "number" &&
		typeof value.idempotencyKey === "string" &&
		typeof payload?.planId === "string" &&
		typeof payload.source === "string"
	);
};

const normalizeMutation = (
	mutation: PendingMutation,
): PendingMutation | null => {
	const updatedAtTime = new Date(mutation.updatedAt).getTime();
	if (
		Number.isNaN(updatedAtTime) ||
		Date.now() - updatedAtTime > MAX_MUTATION_AGE_MS
	) {
		return null;
	}
	if (mutation.type === "saved_event") {
		const eventKey = normalizeEventKey(mutation.payload.eventKey);
		if (!eventKey) return null;
		return {
			...mutation,
			payload: {
				...mutation.payload,
				eventKey,
			},
		};
	}
	if (mutation.type === "route_plan") {
		const planId = mutation.payload.planId.trim();
		if (!planId) return null;
		return {
			...mutation,
			payload: {
				...mutation.payload,
				planId,
			},
		};
	}
	const planId = mutation.payload.planId.trim();
	if (!planId) return null;
	return {
		...mutation,
		payload: {
			...mutation.payload,
			planId,
		},
	};
};

const readQueue = (): PendingMutation[] => {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		const normalizedQueue = parsed
			.filter(
				(item): item is PendingMutation =>
					isSavedEventMutation(item as Partial<PendingMutation>) ||
					isRoutePlanMutation(item as Partial<PendingMutation>) ||
					isRoutePlanDeleteMutation(item as Partial<PendingMutation>),
			)
			.map(normalizeMutation)
			.filter((item): item is PendingMutation => item !== null)
			.slice(-MAX_QUEUE_ITEMS);
		if (normalizedQueue.length !== parsed.length) {
			writeQueue(normalizedQueue);
		}
		return normalizedQueue;
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

const getRoutePlanCompactionKey = (ownerKey: string, planId: string): string =>
	`route_plan:${ownerKey}:${planId.trim()}`;

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

export const enqueueRoutePlanMutation = (input: {
	ownerKey: string;
	planId: string;
	plan: unknown;
	source: string;
}): PendingRoutePlanMutation | null => {
	const ownerKey = input.ownerKey.trim();
	const planId = input.planId.trim();
	if (
		!ownerKey ||
		!planId ||
		typeof input.plan !== "object" ||
		input.plan === null
	) {
		return null;
	}

	const now = new Date().toISOString();
	const compactionKey = getRoutePlanCompactionKey(ownerKey, planId);
	const queue = readQueue();
	const existingIndex = queue.findIndex(
		(item) =>
			(item.type === "route_plan" || item.type === "route_plan_delete") &&
			getRoutePlanCompactionKey(item.ownerKey, item.payload.planId) ===
				compactionKey,
	);
	const mutation: PendingRoutePlanMutation =
		existingIndex >= 0 && queue[existingIndex].type === "route_plan"
			? {
					...queue[existingIndex],
					payload: {
						planId,
						plan: input.plan,
						source: input.source,
					},
					updatedAt: now,
					attempts: 0,
					nextAttemptAt: null,
				}
			: {
					id: createMutationId(),
					type: "route_plan",
					ownerKey,
					payload: {
						planId,
						plan: input.plan,
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

export const enqueueRoutePlanDeleteMutation = (input: {
	ownerKey: string;
	planId: string;
	source: string;
}): PendingRoutePlanDeleteMutation | null => {
	const ownerKey = input.ownerKey.trim();
	const planId = input.planId.trim();
	if (!ownerKey || !planId) return null;

	const now = new Date().toISOString();
	const compactionKey = getRoutePlanCompactionKey(ownerKey, planId);
	const queue = readQueue();
	const existingIndex = queue.findIndex(
		(item) =>
			(item.type === "route_plan" || item.type === "route_plan_delete") &&
			getRoutePlanCompactionKey(item.ownerKey, item.payload.planId) ===
				compactionKey,
	);
	const mutation: PendingRoutePlanDeleteMutation = {
		id: existingIndex >= 0 ? queue[existingIndex].id : createMutationId(),
		type: "route_plan_delete",
		ownerKey,
		payload: {
			planId,
			source: input.source,
		},
		createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : now,
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
	savedEvent?: (input: FlushSavedEventMutationInput) => Promise<boolean>;
	routePlan?: (input: FlushRoutePlanMutationInput) => Promise<boolean>;
	routePlanDelete?: (
		input: FlushRoutePlanDeleteMutationInput,
	) => Promise<boolean>;
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
		const didSucceed =
			mutation.type === "saved_event" && handlers.savedEvent
				? await handlers.savedEvent({ mutation })
				: mutation.type === "route_plan" && handlers.routePlan
					? await handlers.routePlan({ mutation })
					: mutation.type === "route_plan_delete" && handlers.routePlanDelete
						? await handlers.routePlanDelete({ mutation })
						: null;
		if (didSucceed === null) {
			continue;
		}
		attempted += 1;
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

export const getPendingSavedEventMutations = (
	ownerKey: string,
): PendingSavedEventMutation[] =>
	readQueue().filter(
		(mutation): mutation is PendingSavedEventMutation =>
			mutation.type === "saved_event" && mutation.ownerKey === ownerKey,
	);

export const getPendingRoutePlanMutations = (
	ownerKey: string,
): PendingRoutePlanMutation[] =>
	readQueue().filter(
		(mutation): mutation is PendingRoutePlanMutation =>
			mutation.type === "route_plan" && mutation.ownerKey === ownerKey,
	);

export const getPendingRoutePlanDeleteMutations = (
	ownerKey: string,
): PendingRoutePlanDeleteMutation[] =>
	readQueue().filter(
		(mutation): mutation is PendingRoutePlanDeleteMutation =>
			mutation.type === "route_plan_delete" && mutation.ownerKey === ownerKey,
	);

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

export const migratePendingMutationOwnerKey = (
	oldOwnerKey: string,
	newOwnerKey: string,
): number => {
	if (oldOwnerKey === newOwnerKey) return 0;
	const queue = readQueue();
	let migrated = 0;
	const compacted = new Map<string, PendingMutation>();

	for (const mutation of queue) {
		const nextMutation =
			mutation.ownerKey === oldOwnerKey
				? {
						...mutation,
						ownerKey: newOwnerKey,
						idempotencyKey:
							mutation.type === "saved_event"
								? getSavedEventCompactionKey(
										newOwnerKey,
										mutation.payload.eventKey,
									)
								: getRoutePlanCompactionKey(
										newOwnerKey,
										mutation.payload.planId,
									),
					}
				: mutation;
		if (nextMutation !== mutation) migrated += 1;
		const compactionKey =
			nextMutation.type === "saved_event"
				? getSavedEventCompactionKey(
						nextMutation.ownerKey,
						nextMutation.payload.eventKey,
					)
				: getRoutePlanCompactionKey(
						nextMutation.ownerKey,
						nextMutation.payload.planId,
					);
		compacted.set(compactionKey, nextMutation);
	}

	if (migrated > 0) {
		writeQueue(Array.from(compacted.values()));
	}
	return migrated;
};
