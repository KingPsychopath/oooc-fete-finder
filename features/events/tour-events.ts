export const FETE_FINDER_TOUR_EVENT = "oooc:fete-finder-tour:start";
export const FETE_FINDER_TOUR_VERSION = 2;
export const FETE_FINDER_TOUR_STORAGE_KEY = `oooc:fete-finder-tour:v${FETE_FINDER_TOUR_VERSION}`;
export const FETE_FINDER_TOUR_SNOOZE_STORAGE_KEY = `${FETE_FINDER_TOUR_STORAGE_KEY}:snoozed-until`;
export const PENDING_FETE_FINDER_TOUR_STORAGE_KEY =
	"oooc:fete-finder-tour:pending";
export const FETE_FINDER_TOUR_STATE_COMPLETED = "completed";
const FETE_FINDER_TOUR_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const FINAL_TOUR_STATES = new Set([
	FETE_FINDER_TOUR_STATE_COMPLETED,
	"skipped",
	"dismissed",
]);

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

export function requestFeteFinderTour(): void {
	if (typeof window === "undefined") return;

	const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
	const homePath = basePath || "/";
	const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";
	const normalizedHomePath = homePath.replace(/\/+$/, "") || "/";

	if (currentPath !== normalizedHomePath) {
		try {
			window.sessionStorage.setItem(PENDING_FETE_FINDER_TOUR_STORAGE_KEY, "1");
		} catch {
			// The direct navigation still gets users to the tour surface.
		}
		window.location.assign(homePath);
		return;
	}

	window.dispatchEvent(new CustomEvent(FETE_FINDER_TOUR_EVENT));
}

export function snoozeFeteFinderTourPrompt(): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			FETE_FINDER_TOUR_SNOOZE_STORAGE_KEY,
			String(Date.now() + FETE_FINDER_TOUR_PROMPT_SNOOZE_MS),
		);
	} catch {
		// The prompt can still close when storage is unavailable.
	}
}

export function shouldSuppressFeteFinderTourPrompt(): boolean {
	if (typeof window === "undefined") return true;

	try {
		const storedState = window.localStorage.getItem(
			FETE_FINDER_TOUR_STORAGE_KEY,
		);
		if (storedState && FINAL_TOUR_STATES.has(storedState)) return true;

		const snoozedUntil = Number(
			window.localStorage.getItem(FETE_FINDER_TOUR_SNOOZE_STORAGE_KEY),
		);
		if (Number.isFinite(snoozedUntil) && snoozedUntil > Date.now()) {
			return true;
		}
		if (Number.isFinite(snoozedUntil)) {
			window.localStorage.removeItem(FETE_FINDER_TOUR_SNOOZE_STORAGE_KEY);
		}
		return false;
	} catch {
		return false;
	}
}
