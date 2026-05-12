export const FETE_FINDER_TOUR_EVENT = "oooc:fete-finder-tour:start";
export const FETE_FINDER_TOUR_VERSION = 2;
export const FETE_FINDER_TOUR_STORAGE_KEY = `oooc:fete-finder-tour:v${FETE_FINDER_TOUR_VERSION}`;
export const PENDING_FETE_FINDER_TOUR_STORAGE_KEY =
	"oooc:fete-finder-tour:pending";

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
