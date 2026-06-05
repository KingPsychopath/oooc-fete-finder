export const TICKET_EXCHANGE_TOUR_VERSION = 1;
export const TICKET_EXCHANGE_TOUR_STORAGE_KEY = `oooc:ticket-exchange-tour:v${TICKET_EXCHANGE_TOUR_VERSION}`;
export const TICKET_EXCHANGE_TOUR_PROMPT_STORAGE_KEY = `${TICKET_EXCHANGE_TOUR_STORAGE_KEY}:prompt`;
export const TICKET_EXCHANGE_TOUR_PROMPT_SESSION_KEY = `${TICKET_EXCHANGE_TOUR_STORAGE_KEY}:prompt-shown-session`;
export const PENDING_TICKET_EXCHANGE_TOUR_STORAGE_KEY = `${TICKET_EXCHANGE_TOUR_STORAGE_KEY}:pending`;
export const TICKET_EXCHANGE_TOUR_EVENT = "oooc:ticket-exchange-tour:start";

export const TICKET_EXCHANGE_TOUR_STATE_COMPLETED = "completed";
export const TICKET_EXCHANGE_TOUR_STATE_SKIPPED = "skipped";
export const TICKET_EXCHANGE_TOUR_STATE_DISMISSED = "dismissed";

const TICKET_EXCHANGE_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

type TicketExchangePromptState = {
	dismissedUntil?: number;
	lastShownAt?: number;
	convertedAt?: number;
};

const FINAL_TICKET_EXCHANGE_TOUR_STATES = new Set([
	TICKET_EXCHANGE_TOUR_STATE_COMPLETED,
	TICKET_EXCHANGE_TOUR_STATE_SKIPPED,
	TICKET_EXCHANGE_TOUR_STATE_DISMISSED,
]);

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const readPromptState = (): TicketExchangePromptState => {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(
			TICKET_EXCHANGE_TOUR_PROMPT_STORAGE_KEY,
		);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Partial<TicketExchangePromptState>;
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

const writePromptState = (state: TicketExchangePromptState): void => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			TICKET_EXCHANGE_TOUR_PROMPT_STORAGE_KEY,
			JSON.stringify(state),
		);
	} catch {
		// Prompt throttling is best-effort.
	}
};

export const getTicketExchangeTourState = (): string | null => {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage.getItem(TICKET_EXCHANGE_TOUR_STORAGE_KEY);
	} catch {
		return null;
	}
};

export const writeTicketExchangeTourState = (state: string): void => {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(TICKET_EXCHANGE_TOUR_STORAGE_KEY, state);
		if (state === TICKET_EXCHANGE_TOUR_STATE_COMPLETED) {
			window.localStorage.setItem(
				`${TICKET_EXCHANGE_TOUR_STORAGE_KEY}:completed-at`,
				String(Date.now()),
			);
		}
	} catch {
		// The tour still works when storage is unavailable.
	}
};

export const shouldSuppressTicketExchangeTourPrompt = (): boolean => {
	const state = getTicketExchangeTourState();
	return Boolean(state && FINAL_TICKET_EXCHANGE_TOUR_STATES.has(state));
};

export const markTicketExchangeTourPromptShown = (): void => {
	if (typeof window === "undefined") return;
	const state = readPromptState();
	writePromptState({ ...state, lastShownAt: Date.now() });
	try {
		window.sessionStorage.setItem(TICKET_EXCHANGE_TOUR_PROMPT_SESSION_KEY, "1");
	} catch {
		// Session throttling is best-effort.
	}
};

export const snoozeTicketExchangeTourPrompt = (): void => {
	const state = readPromptState();
	writePromptState({
		...state,
		dismissedUntil: Date.now() + TICKET_EXCHANGE_PROMPT_SNOOZE_MS,
	});
};

export const markTicketExchangeTourPromptConverted = (): void => {
	const state = readPromptState();
	writePromptState({ ...state, convertedAt: Date.now() });
};

export const shouldShowTicketExchangeTourPrompt = (): boolean => {
	if (typeof window === "undefined") return false;
	try {
		if (shouldSuppressTicketExchangeTourPrompt()) return false;
		const promptState = readPromptState();
		if (
			typeof promptState.dismissedUntil === "number" &&
			promptState.dismissedUntil > Date.now()
		) {
			return false;
		}
		if (
			window.sessionStorage.getItem(TICKET_EXCHANGE_TOUR_PROMPT_SESSION_KEY) ===
			"1"
		) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
};

export const requestTicketExchangeTour = (): void => {
	if (typeof window === "undefined") return;

	const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
	const exchangePath = `${basePath}/exchange`;
	const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
	const normalizedExchangePath =
		exchangePath.replace(/\/+$/, "") || "/exchange";

	try {
		window.sessionStorage.setItem(
			PENDING_TICKET_EXCHANGE_TOUR_STORAGE_KEY,
			"1",
		);
		markTicketExchangeTourPromptConverted();
	} catch {
		// Direct navigation still gets users to the ticket exchange.
	}

	if (
		currentPath !== normalizedExchangePath &&
		!currentPath.startsWith(`${normalizedExchangePath}/`)
	) {
		window.location.assign(exchangePath);
		return;
	}

	try {
		window.sessionStorage.removeItem(PENDING_TICKET_EXCHANGE_TOUR_STORAGE_KEY);
	} catch {
		// The in-page start can continue without session storage.
	}
	window.dispatchEvent(new CustomEvent(TICKET_EXCHANGE_TOUR_EVENT));
};

export const consumePendingTicketExchangeTourRequest = (): boolean => {
	if (typeof window === "undefined") return false;
	try {
		const pending =
			window.sessionStorage.getItem(
				PENDING_TICKET_EXCHANGE_TOUR_STORAGE_KEY,
			) === "1";
		if (pending) {
			window.sessionStorage.removeItem(
				PENDING_TICKET_EXCHANGE_TOUR_STORAGE_KEY,
			);
		}
		return pending;
	} catch {
		return false;
	}
};
