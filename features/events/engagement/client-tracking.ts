import type { EventEngagementAction } from "@/features/events/engagement/types";
import type { MapProvider } from "@/features/maps/types";

const SESSION_STORAGE_KEY = "oooc:event-engagement-session";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const BATCH_FLUSH_DELAY_MS = 3000;
const MAX_BATCH_SIZE = 20;
const QUEUE_STORAGE_PREFIX = "oooc:analytics-queue:";
const MAP_OPEN_DEDUPE_MS = 30_000;

type ClientContext = ReturnType<typeof getClientContext>;

type EventEngagementPayload = {
	eventKey: string;
	actionType: EventEngagementAction;
	sessionId: string | null;
	source?: string;
	path: string;
	isAuthenticated: boolean;
	clientContext: ClientContext;
	recordedAt: string;
};

type DiscoveryAnalyticsPayload = {
	actionType:
		| "search"
		| "filter_apply"
		| "filter_clear"
		| "map_interaction"
		| "sort_change"
		| "location_request"
		| "tour_interaction"
		| "nav_click";
	sessionId: string | null;
	filterGroup?: string;
	filterValue?: string;
	searchQuery?: string;
	path: string;
	clientContext: ClientContext;
	recordedAt: string;
};

type GenrePreferencePayload = {
	genre: string;
	incrementBy: number;
	clientContext: ClientContext;
	recordedAt: string;
};

type QueueName = "engagement" | "discovery" | "preference";

const queues: Record<QueueName, unknown[]> = {
	engagement: [],
	discovery: [],
	preference: [],
};
const flushTimers: Partial<Record<QueueName, ReturnType<typeof setTimeout>>> = {};
const loadedQueues = new Set<QueueName>();
const recentMapOpenKeys = new Map<string, number>();

const endpoints: Record<QueueName, string> = {
	engagement: `${basePath}/api/track`,
	discovery: `${basePath}/api/track/discovery`,
	preference: `${basePath}/api/user/preference`,
};

const createSessionId = (): string => {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getOrCreateEngagementSessionId = (): string | null => {
	if (typeof window === "undefined") return null;
	try {
		const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
		if (stored && stored.trim().length > 0) {
			return stored.trim();
		}
		const created = createSessionId();
		window.localStorage.setItem(SESSION_STORAGE_KEY, created);
		return created;
	} catch {
		return null;
	}
};

const getDeviceClass = (): "mobile" | "tablet" | "desktop" | "unknown" => {
	if (typeof navigator === "undefined") return "unknown";
	const userAgent = navigator.userAgent.toLowerCase();
	const coarsePointer =
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(pointer: coarse)").matches;
	if (/ipad|tablet/.test(userAgent)) return "tablet";
	if (/iphone|android.*mobile|mobile/.test(userAgent)) return "mobile";
	if (/android/.test(userAgent)) return "tablet";
	if (coarsePointer) return "mobile";
	return "desktop";
};

const getPlatform = (): string => {
	if (typeof navigator === "undefined") return "unknown";
	const userAgent = navigator.userAgent.toLowerCase();
	const platform = navigator.platform.toLowerCase();
	if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
	if (/android/.test(userAgent)) return "android";
	if (/mac/.test(platform) || /mac os x/.test(userAgent)) return "macos";
	if (/win/.test(platform) || /windows/.test(userAgent)) return "windows";
	if (/linux/.test(platform) || /linux/.test(userAgent)) return "linux";
	return "other";
};

const getBrowserFamily = (): string => {
	if (typeof navigator === "undefined") return "unknown";
	const userAgent = navigator.userAgent.toLowerCase();
	if (/edg\//.test(userAgent)) return "edge";
	if (/firefox\//.test(userAgent)) return "firefox";
	if (/chrome\//.test(userAgent) || /crios\//.test(userAgent)) return "chrome";
	if (/safari\//.test(userAgent)) return "safari";
	return "other";
};

export const getClientContext = () => {
	if (typeof window === "undefined") {
		return {
			deviceClass: "unknown",
			platform: "unknown",
			browserFamily: "unknown",
			timezone: null,
			locale: null,
		};
	}
	return {
		deviceClass: getDeviceClass(),
		platform: getPlatform(),
		browserFamily: getBrowserFamily(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
		locale: navigator.language || null,
	};
};

const getQueueStorageKey = (name: QueueName): string =>
	`${QUEUE_STORAGE_PREFIX}${name}`;

const persistQueue = (name: QueueName) => {
	if (typeof window === "undefined") return;
	try {
		const queue = queues[name];
		if (queue.length === 0) {
			window.localStorage.removeItem(getQueueStorageKey(name));
			return;
		}
		window.localStorage.setItem(getQueueStorageKey(name), JSON.stringify(queue));
	} catch {
		// In-memory queue still works when storage is unavailable.
	}
};

const loadQueue = (name: QueueName) => {
	if (loadedQueues.has(name) || typeof window === "undefined") return;
	loadedQueues.add(name);
	try {
		const raw = window.localStorage.getItem(getQueueStorageKey(name));
		if (!raw) return;
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return;
		queues[name] = parsed;
	} catch {
		window.localStorage.removeItem(getQueueStorageKey(name));
	}
};

const postPayload = (
	url: string,
	payload: string,
	preferBeacon: boolean,
	onFailure: () => void,
) => {
	if (preferBeacon) {
		try {
			if (
				typeof navigator !== "undefined" &&
				typeof navigator.sendBeacon === "function"
			) {
				const blob = new Blob([payload], { type: "application/json" });
				if (navigator.sendBeacon(url, blob)) {
					return;
				}
			}
		} catch {
			// Fall through to fetch fallback.
		}
	}

	void fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: payload,
		keepalive: true,
	}).catch(onFailure);
};

const flushQueue = (name: QueueName, preferBeacon = false) => {
	if (typeof window === "undefined") return;
	loadQueue(name);
	const timer = flushTimers[name];
	if (timer) {
		clearTimeout(timer);
		delete flushTimers[name];
	}

	const queue = queues[name];
	if (queue.length === 0) return;
	const batch = queue.splice(0, MAX_BATCH_SIZE);
	persistQueue(name);
	const payload =
		batch.length === 1
			? JSON.stringify(batch[0])
			: JSON.stringify({ events: batch });
	postPayload(endpoints[name], payload, preferBeacon, () => {
		queues[name].unshift(...batch);
		persistQueue(name);
		scheduleFlush(name);
	});

	if (queue.length > 0) {
		flushQueue(name, preferBeacon);
	}
};

const scheduleFlush = (name: QueueName) => {
	if (flushTimers[name]) return;
	flushTimers[name] = setTimeout(() => {
		flushQueue(name);
	}, BATCH_FLUSH_DELAY_MS);
};

const enqueuePayload = (name: QueueName, payload: unknown) => {
	if (typeof window === "undefined") return;
	loadQueue(name);
	const queue = queues[name];
	queue.push(payload);
	persistQueue(name);
	if (queue.length >= MAX_BATCH_SIZE) {
		flushQueue(name);
		return;
	}
	scheduleFlush(name);
};

const installFlushListeners = (() => {
	let installed = false;
	return () => {
		if (installed || typeof window === "undefined") return;
		installed = true;
		const flushAll = () => {
			flushQueue("engagement", true);
			flushQueue("discovery", true);
			flushQueue("preference", true);
		};
		window.addEventListener("pagehide", flushAll);
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") {
				flushAll();
			}
		});
	};
})();

export const trackEventEngagement = (input: {
	eventKey: string;
	actionType: EventEngagementAction;
	source?: string;
	isAuthenticated?: boolean;
}) => {
	if (typeof window === "undefined") return;
	const eventKey = input.eventKey?.trim();
	if (!eventKey) return;
	installFlushListeners();

	const payload: EventEngagementPayload = {
		eventKey,
		actionType: input.actionType,
		sessionId: getOrCreateEngagementSessionId(),
		source: input.source,
		path: window.location.pathname,
		isAuthenticated: input.isAuthenticated ?? false,
		clientContext: getClientContext(),
		recordedAt: new Date().toISOString(),
	};
	enqueuePayload("engagement", payload);
};

export const trackMapOpen = (input: {
	eventKey: string;
	provider: MapProvider;
	isAuthenticated?: boolean;
}) => {
	if (typeof window === "undefined") return;
	const eventKey = input.eventKey.trim();
	if (!eventKey) return;
	const now = Date.now();
	const dedupeKey = `${eventKey}:${input.provider}`;
	const lastTrackedAt = recentMapOpenKeys.get(dedupeKey) ?? 0;
	if (now - lastTrackedAt < MAP_OPEN_DEDUPE_MS) return;
	recentMapOpenKeys.set(dedupeKey, now);
	trackEventEngagement({
		eventKey,
		actionType: "map_open",
		source: `modal_location:${input.provider}`,
		isAuthenticated: input.isAuthenticated,
	});
};

export const trackMapPreferenceChange = (input: {
	eventKey: string;
	from: MapProvider;
	to: MapProvider;
	source: "modal_settings" | "selection_default";
	isAuthenticated?: boolean;
}) => {
	if (input.from === input.to) return;
	trackEventEngagement({
		eventKey: input.eventKey,
		actionType: "map_preference_change",
		source: `${input.source}:${input.from}:${input.to}`,
		isAuthenticated: input.isAuthenticated,
	});
};

export const trackDiscoveryAnalytics = (input: {
	actionType:
		| "search"
		| "filter_apply"
		| "filter_clear"
		| "map_interaction"
		| "sort_change"
		| "location_request"
		| "tour_interaction"
		| "nav_click";
	filterGroup?: string;
	filterValue?: string;
	searchQuery?: string;
}) => {
	if (typeof window === "undefined") return;
	installFlushListeners();
	const payload: DiscoveryAnalyticsPayload = {
		actionType: input.actionType,
		sessionId: getOrCreateEngagementSessionId(),
		filterGroup: input.filterGroup,
		filterValue: input.filterValue,
		searchQuery: input.searchQuery,
		path: window.location.pathname,
		clientContext: getClientContext(),
		recordedAt: new Date().toISOString(),
	};
	enqueuePayload("discovery", payload);
};

export const trackTourInteraction = (input: {
	action: "prompt_shown" | "start" | "complete" | "skip" | "auth_required";
	stepId?: string;
	source?: string;
}) => {
	trackDiscoveryAnalytics({
		actionType: "tour_interaction",
		filterGroup: "tour",
		filterValue: [input.action, input.stepId, input.source]
			.filter(Boolean)
			.join(":"),
	});
};

export const trackNavigationClick = (input: {
	group:
		| "homepage_link"
		| "quick_action"
		| "mobile_nav"
		| "footer_link"
		| "header_nav";
	label: string;
}) => {
	trackDiscoveryAnalytics({
		actionType: "nav_click",
		filterGroup: input.group,
		filterValue: input.label,
	});
};

export const trackGenrePreference = (genre: string) => {
	if (typeof window === "undefined") return;
	installFlushListeners();
	const payload: GenrePreferencePayload = {
		genre,
		incrementBy: 1,
		clientContext: getClientContext(),
		recordedAt: new Date().toISOString(),
	};
	enqueuePayload("preference", payload);
};
