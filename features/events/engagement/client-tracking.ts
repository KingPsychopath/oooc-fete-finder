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
		sessionId: getOrCreateEngagementSessionId(),
		source: input.source,
		path: window.location.pathname,
		isAuthenticated: input.isAuthenticated ?? false,
		clientContext: getClientContext(),
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
		sessionId: getOrCreateEngagementSessionId(),
		filterGroup: input.filterGroup,
		filterValue: input.filterValue,
		searchQuery: input.searchQuery,
		path: window.location.pathname,
		clientContext: getClientContext(),
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
		body: JSON.stringify({
			genre,
			incrementBy: 1,
			clientContext: getClientContext(),
		}),
		keepalive: true,
	}).catch(() => undefined);
};
