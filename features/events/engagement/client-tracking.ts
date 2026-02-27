import type { EventEngagementAction } from "@/features/events/engagement/types";

const SESSION_STORAGE_KEY = "oooc:event-engagement-session";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const createSessionId = (): string => {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getOrCreateSessionId = (): string | null => {
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

export const trackEventEngagement = (input: {
	eventKey: string;
	actionType: EventEngagementAction;
	source?: string;
	isAuthenticated?: boolean;
}) => {
	if (typeof window === "undefined") return;
	const eventKey = input.eventKey?.trim();
	if (!eventKey) return;

	const payload = JSON.stringify({
		eventKey,
		actionType: input.actionType,
		sessionId: getOrCreateSessionId(),
		source: input.source,
		path: window.location.pathname,
		isAuthenticated: input.isAuthenticated ?? false,
	});

	try {
		if (
			typeof navigator !== "undefined" &&
			typeof navigator.sendBeacon === "function"
		) {
			const blob = new Blob([payload], { type: "application/json" });
			const sent = navigator.sendBeacon(`${basePath}/api/track`, blob);
			if (sent) return;
		}
	} catch {
		// Fall through to fetch fallback.
	}

	void fetch(`${basePath}/api/track`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: payload,
		keepalive: true,
	}).catch(() => undefined);
};

export const trackDiscoveryAnalytics = (input: {
	actionType: "search" | "filter_apply" | "filter_clear";
	filterGroup?: string;
	filterValue?: string;
	searchQuery?: string;
}) => {
	if (typeof window === "undefined") return;
	const payload = JSON.stringify({
		actionType: input.actionType,
		sessionId: getOrCreateSessionId(),
		filterGroup: input.filterGroup,
		filterValue: input.filterValue,
		searchQuery: input.searchQuery,
		path: window.location.pathname,
	});
	void fetch(`${basePath}/api/track/discovery`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: payload,
		keepalive: true,
	}).catch(() => undefined);
};

export const trackGenrePreference = (genre: string) => {
	if (typeof window === "undefined") return;
	void fetch(`${basePath}/api/user/preference`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ genre, incrementBy: 1 }),
		keepalive: true,
	}).catch(() => undefined);
};
