import {
	FETE_FINDER_TOUR_STATE_COMPLETED,
	FETE_FINDER_TOUR_STORAGE_KEY,
} from "@/features/events/tour-events";

export const PLAN_ROUTE_TOUR_VERSION = 1;
export const PLAN_ROUTE_TOUR_STORAGE_KEY = `oooc:plan-route-tour:v${PLAN_ROUTE_TOUR_VERSION}`;
export const PLAN_ROUTE_TOUR_PROMPT_STORAGE_KEY = `${PLAN_ROUTE_TOUR_STORAGE_KEY}:prompt`;
export const PENDING_PLAN_ROUTE_TOUR_STORAGE_KEY = `${PLAN_ROUTE_TOUR_STORAGE_KEY}:pending`;
export const PLANS_VISITED_STORAGE_KEY = "oooc:plans:last-visited-at";
export const PLAN_ROUTE_PROMPT_SESSION_KEY = `${PLAN_ROUTE_TOUR_STORAGE_KEY}:prompt-shown-session`;

export const PLAN_ROUTE_TOUR_STATE_COMPLETED = "completed";
export const PLAN_ROUTE_TOUR_STATE_SKIPPED = "skipped";
export const PLAN_ROUTE_TOUR_STATE_DISMISSED = "dismissed";

const PLAN_ROUTE_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const PLAN_ROUTE_RECENT_VISIT_MS = 7 * 24 * 60 * 60 * 1000;
const HOME_TOUR_RECENT_COMPLETION_MS = 45 * 60 * 1000;

type PlanRoutePromptState = {
	dismissedUntil?: number;
	lastShownAt?: number;
	convertedAt?: number;
};

const FINAL_PLAN_TOUR_STATES = new Set([
	PLAN_ROUTE_TOUR_STATE_COMPLETED,
	PLAN_ROUTE_TOUR_STATE_SKIPPED,
	PLAN_ROUTE_TOUR_STATE_DISMISSED,
]);

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const readNumber = (key: string): number | null => {
	if (typeof window === "undefined") return null;
	try {
		const value = Number(window.localStorage.getItem(key));
		return Number.isFinite(value) ? value : null;
	} catch {
		return null;
	}
};

const readPromptState = (): PlanRoutePromptState => {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(PLAN_ROUTE_TOUR_PROMPT_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Partial<PlanRoutePromptState>;
		return {
			dismissedUntil:
				typeof parsed.dismissedUntil === "number"
					? parsed.dismissedUntil
					: undefined,
			lastShownAt:
				typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : undefined,
			convertedAt:
				typeof parsed.convertedAt === "number" ? parsed.convertedAt : undefined,
		};
	} catch {
		return {};
	}
};

const writePromptState = (state: PlanRoutePromptState): void => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			PLAN_ROUTE_TOUR_PROMPT_STORAGE_KEY,
			JSON.stringify(state),
		);
	} catch {
		// Prompt throttling is best-effort.
	}
};

export const getPlanRouteTourState = (): string | null => {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(PLAN_ROUTE_TOUR_STORAGE_KEY);
	} catch {
		return null;
	}
};

export const writePlanRouteTourState = (state: string): void => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(PLAN_ROUTE_TOUR_STORAGE_KEY, state);
		if (state === PLAN_ROUTE_TOUR_STATE_COMPLETED) {
			window.localStorage.setItem(
				`${PLAN_ROUTE_TOUR_STORAGE_KEY}:completed-at`,
				String(Date.now()),
			);
		}
	} catch {
		// The tour still works when storage is unavailable.
	}
};

export const shouldSuppressPlanRouteTourPrompt = (): boolean => {
	const state = getPlanRouteTourState();
	return Boolean(state && FINAL_PLAN_TOUR_STATES.has(state));
};

export const markPlansPageVisited = (): void => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(PLANS_VISITED_STORAGE_KEY, String(Date.now()));
	} catch {
		// Visit tracking is best-effort.
	}
};

export const markPlanRoutePromptShown = (): void => {
	if (typeof window === "undefined") return;
	const state = readPromptState();
	writePromptState({ ...state, lastShownAt: Date.now() });
	try {
		window.sessionStorage.setItem(PLAN_ROUTE_PROMPT_SESSION_KEY, "1");
	} catch {
		// Session throttling is best-effort.
	}
};

export const snoozePlanRoutePrompt = (): void => {
	const state = readPromptState();
	writePromptState({
		...state,
		dismissedUntil: Date.now() + PLAN_ROUTE_PROMPT_SNOOZE_MS,
	});
};

export const markPlanRoutePromptConverted = (): void => {
	const state = readPromptState();
	writePromptState({ ...state, convertedAt: Date.now() });
};

export const shouldShowPlanRoutePrompt = (): boolean => {
	if (typeof window === "undefined") return false;
	try {
		if (
			window.localStorage.getItem(FETE_FINDER_TOUR_STORAGE_KEY) !==
			FETE_FINDER_TOUR_STATE_COMPLETED
		) {
			return false;
		}

		const homeTourCompletedAt = readNumber(
			`${FETE_FINDER_TOUR_STORAGE_KEY}:completed-at`,
		);
		if (
			homeTourCompletedAt !== null &&
			Date.now() - homeTourCompletedAt < HOME_TOUR_RECENT_COMPLETION_MS
		) {
			return false;
		}

		const promptState = readPromptState();
		if (
			typeof promptState.dismissedUntil === "number" &&
			promptState.dismissedUntil > Date.now()
		) {
			return false;
		}

		if (window.sessionStorage.getItem(PLAN_ROUTE_PROMPT_SESSION_KEY) === "1") {
			return false;
		}

		const plansVisitedAt = readNumber(PLANS_VISITED_STORAGE_KEY);
		if (
			plansVisitedAt !== null &&
			Date.now() - plansVisitedAt < PLAN_ROUTE_RECENT_VISIT_MS
		) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
};

export const requestPlanRouteTour = (): void => {
	if (typeof window === "undefined") return;
	const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
	try {
		window.sessionStorage.setItem(PENDING_PLAN_ROUTE_TOUR_STORAGE_KEY, "1");
		markPlanRoutePromptConverted();
	} catch {
		// Direct navigation still gets users to the route planner.
	}
	window.location.assign(`${basePath}/plans`);
};

export const consumePendingPlanRouteTourRequest = (): boolean => {
	if (typeof window === "undefined") return false;
	try {
		const pending =
			window.sessionStorage.getItem(PENDING_PLAN_ROUTE_TOUR_STORAGE_KEY) ===
			"1";
		if (pending) {
			window.sessionStorage.removeItem(PENDING_PLAN_ROUTE_TOUR_STORAGE_KEY);
		}
		return pending;
	} catch {
		return false;
	}
};
