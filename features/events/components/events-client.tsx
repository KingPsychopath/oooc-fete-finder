"use client";

import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import AuthGate from "@/features/auth/components/AuthGate";
import { AllEvents } from "@/features/events/components/AllEvents";
import EventModal from "@/features/events/components/EventModal";
import EventStats from "@/features/events/components/EventStats";
import SearchBar from "@/features/events/components/SearchBar";
import { getCountryOption } from "@/features/events/countries";
import { getDiscoveryEligibleEvents } from "@/features/events/discovery-eligibility";
import { trackEventEngagement } from "@/features/events/engagement/client-tracking";
import { FeaturedEvents } from "@/features/events/featured/FeaturedEvents";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import {
	getCustomGenreColor,
	toGenreLabel,
} from "@/features/events/genre-normalization";
import { useEventFilters } from "@/features/events/hooks/use-event-filters";
import {
	createFreshActivityComparator,
	createRegularEventsComparator,
} from "@/features/events/ordering";
import type { SearchChip } from "@/features/events/search-chips";
import { getSocialProofDisplayModes } from "@/features/events/social-proof";
import {
	FETE_FINDER_TOUR_EVENT,
	PENDING_FETE_FINDER_TOUR_STORAGE_KEY,
} from "@/features/events/tour-events";
import {
	type Event,
	MUSIC_GENRES,
	type MusicGenreDefinition,
	type Nationality,
} from "@/features/events/types";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { clientLog } from "@/lib/platform/client-logger";
import { ChevronDown, Filter, MapPin, Maximize2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

interface EventsClientProps {
	initialEvents: Event[];
	fullEventsPath?: string;
	mapLoadStrategy: MapLoadStrategy;
	eventUpdateRequestsEnabled?: boolean;
	dynamicSearchChips?: SearchChip[];
}

const EVENT_MODAL_HISTORY_FLAG = "__ooocEventModalHistory";
const REQUEST_UPDATE_PARAM = "requestUpdate";
type EventSortMode = "upcoming" | "fresh-activity";
type PendingAuthAction = "show-oooc-picks" | { type: "search"; query: string };

const EmailGateModal = lazy(
	() => import("@/features/auth/components/EmailGateModal"),
);

const FilterPanel = lazy(
	() => import("@/features/events/components/FilterPanel"),
);

const EventsMapCard = lazy(async () => {
	const module = await import("@/features/maps/components/events-map-card");
	return { default: module.EventsMapCard };
});

const FeteFinderTour = lazy(async () => {
	const module = await import("@/features/events/components/FeteFinderTour");
	return { default: module.FeteFinderTour };
});

const NoopSuspenseFallback = (
	<span className="sr-only" aria-hidden="true">
		Loading
	</span>
);

interface DeferredMapShellProps {
	eventsCount: number;
	isExpanded: boolean;
	onOpen: () => void;
	hasActiveFilters: boolean;
	activeFiltersCount: number;
}

function DeferredMapShell({
	eventsCount,
	isExpanded,
	onOpen,
	hasActiveFilters,
	activeFiltersCount,
}: DeferredMapShellProps) {
	return (
		<div className="ooo-site-card overflow-hidden rounded-xl border border-border bg-card">
			<div className="border-b border-border/70 px-3 py-5 sm:px-6">
				<div className="flex flex-col gap-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
								<div className="flex min-w-0 items-center gap-2">
									<MapPin className="h-5 w-5 shrink-0" />
									<h3 className="truncate text-lg [font-family:var(--ooo-font-display)] font-light sm:text-2xl">
										Paris Event Map
									</h3>
								</div>
								<span className="rounded-full border border-border/70 bg-secondary/72 px-2 py-0.5 text-xs text-secondary-foreground">
									{eventsCount} event{eventsCount !== 1 ? "s" : ""}
								</span>
								{hasActiveFilters && (
									<span className="rounded-full border border-border/70 bg-background/62 px-2 py-0.5 text-xs text-muted-foreground">
										{activeFiltersCount} active
									</span>
								)}
							</div>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								Open the interactive map when location matters.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onOpen}
							className="h-8 shrink-0 rounded-full px-3 text-xs"
							aria-expanded={isExpanded}
						>
							<ChevronDown
								className={`mr-1.5 h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
							/>
							Expand
						</Button>
					</div>
				</div>
			</div>
			<div className="px-3 py-5 pt-3 sm:px-6">
				<button
					type="button"
					onClick={onOpen}
					className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-border/65 bg-background/50 px-4 text-center transition-colors hover:bg-accent/45 sm:h-32"
				>
					<span className="inline-flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
						<Maximize2 className="h-4 w-4" />
						Expand to load the live Paris map
					</span>
					<span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-md bg-gradient-to-t from-card via-card/70 to-transparent" />
				</button>
			</div>
		</div>
	);
}

interface DeferredFilterShellProps {
	onOpen: () => void;
	hasActiveFilters: boolean;
	activeFiltersCount: number;
	canUseProtectedDiscovery: boolean;
	onAuthRequired: () => void;
}

function DeferredFilterShell({
	onOpen,
	hasActiveFilters,
	activeFiltersCount,
	canUseProtectedDiscovery,
	onAuthRequired,
}: DeferredFilterShellProps) {
	const handleClick = canUseProtectedDiscovery ? onOpen : onAuthRequired;

	return (
		<div id="tour-filter-panel" className="hidden lg:block">
			<div className="ooo-site-card overflow-hidden rounded-xl border border-border bg-card">
				<div className="flex items-center justify-between gap-3 border-b border-border/70 px-3 py-5">
					<div className="flex min-w-0 items-center">
						<Filter className="mr-2.5 h-[1.15rem] w-[1.15rem] shrink-0 stroke-[1.75]" />
						<h3 className="truncate text-[1.5rem] [font-family:var(--ooo-font-display)] font-light leading-none tracking-[0.01em]">
							Filters
						</h3>
						{hasActiveFilters && (
							<span className="ml-2 shrink-0 rounded-full border border-border/70 bg-secondary/72 px-2 py-0.5 text-xs text-secondary-foreground">
								{activeFiltersCount} active
							</span>
						)}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						onClick={handleClick}
						aria-label={
							canUseProtectedDiscovery ? "Open filters" : "Unlock filters"
						}
						className="rounded-full border border-border/70 bg-background/66 text-muted-foreground hover:bg-accent hover:text-foreground"
					>
						<ChevronDown className="h-4 w-4" />
					</Button>
				</div>
				<div className="px-3 py-3">
					<button
						type="button"
						onClick={handleClick}
						className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border/75 bg-background/45 px-3 text-center text-sm text-muted-foreground transition-colors hover:bg-accent/45"
					>
						{canUseProtectedDiscovery
							? "Open filters to narrow by day, area, genre and price."
							: "Continue with email to unlock filters and search."}
					</button>
				</div>
			</div>
		</div>
	);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isEventPayload = (value: unknown): value is Event =>
	isRecord(value) &&
	typeof value.eventKey === "string" &&
	typeof value.id === "string" &&
	typeof value.name === "string";

const parseFullEventsResponse = (value: unknown): Event[] | null => {
	if (!isRecord(value) || !Array.isArray(value.events)) return null;
	if (!value.events.every(isEventPayload)) return null;
	return value.events;
};

const parseEventDetailsResponse = (value: unknown): Event | null => {
	if (!isRecord(value) || !isEventPayload(value.event)) return null;
	return value.event;
};

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const decodePathSegment = (value: string): string => {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

const removeLegacyEventParams = (params: URLSearchParams): URLSearchParams => {
	const next = new URLSearchParams(params.toString());
	next.delete("event");
	next.delete("slug");
	return next;
};

const appendQuery = (path: string, params: URLSearchParams): string => {
	const query = params.toString();
	return query ? `${path}?${query}` : path;
};

const orderEventsForDiscoverySurface = (
	events: Event[],
	sortMode: EventSortMode,
): Event[] => {
	const featuredMatches: Event[] = [];
	const promotedMatches: Event[] = [];
	const regularMatches: Event[] = [];
	const now = new Date();
	const regularEventsComparator =
		sortMode === "fresh-activity"
			? createFreshActivityComparator(now)
			: createRegularEventsComparator(now);

	for (const event of events) {
		if (shouldDisplayFeaturedEvent(event)) {
			featuredMatches.push(event);
			continue;
		}
		if (event.isPromoted === true) {
			promotedMatches.push(event);
			continue;
		}
		regularMatches.push(event);
	}

	return [
		...featuredMatches,
		...promotedMatches,
		...[...regularMatches].sort(regularEventsComparator),
	];
};

const buildAvailableGenresForEvents = (
	events: Event[],
): MusicGenreDefinition[] => {
	const genreByKey = new Map<string, MusicGenreDefinition>(
		MUSIC_GENRES.map((genre) => [genre.key, { ...genre }]),
	);
	for (const event of events) {
		for (const genre of event.genre ?? []) {
			if (genreByKey.has(genre)) continue;
			genreByKey.set(genre, {
				key: genre,
				label: toGenreLabel(genre),
				color: getCustomGenreColor(genre),
				isActive: true,
			});
		}
	}
	return Array.from(genreByKey.values()).sort((left, right) =>
		left.label.localeCompare(right.label),
	);
};

const buildAvailableNationalitiesForEvents = (events: Event[]) => {
	const optionsByCode = new Map<
		Nationality,
		{ key: Nationality; label: string; flag: string; shortCode: string }
	>();
	for (const event of events) {
		for (const nationality of event.nationality ?? []) {
			if (optionsByCode.has(nationality)) continue;
			const country = getCountryOption(nationality);
			optionsByCode.set(nationality, {
				key: nationality,
				label: country?.label ?? nationality,
				flag: country?.flag ?? "",
				shortCode: nationality,
			});
		}
	}
	return Array.from(optionsByCode.values()).sort((left, right) =>
		left.label.localeCompare(right.label),
	);
};

export function EventsClient({
	initialEvents,
	fullEventsPath,
	mapLoadStrategy,
	eventUpdateRequestsEnabled = true,
	dynamicSearchChips = [],
}: EventsClientProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [events, setEvents] = useState(initialEvents);
	const [hasLoadedFullEvents, setHasLoadedFullEvents] =
		useState(!fullEventsPath);
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isMapExpanded, setIsMapExpanded] = useState(false);
	const [isFilterExpanded, setIsFilterExpanded] = useState(false);
	const [showEmailGate, setShowEmailGate] = useState(false);
	const [isRequestUpdateOpen, setIsRequestUpdateOpen] = useState(false);
	const [sortMode, setSortMode] = useState<EventSortMode>("upcoming");
	const [hasMountedMapIsland, setHasMountedMapIsland] = useState(false);
	const [hasMountedFilterIsland, setHasMountedFilterIsland] = useState(false);
	const [hasMountedTourIsland, setHasMountedTourIsland] = useState(false);
	const pendingAuthActionRef = useRef<PendingAuthAction | null>(null);
	const invalidEventParamCountRef = useRef(0);
	const fullEventsPromiseRef = useRef<Promise<Event[] | null> | null>(null);
	const eventDetailsPromiseRef = useRef(new Map<string, Promise<Event | null>>());
	const hasMountedTourIslandRef = useRef(false);
	const allEventsRef = useRef<HTMLDivElement>(null);
	const {
		isAuthenticated,
		isAuthResolved,
		isOnline,
		authMode,
		offlineGraceExpiresAt,
		refreshSession,
	} = useAuth();
	const canUseProtectedDiscovery =
		isAuthenticated || authMode === "offline-grace";

	const offlineGraceExpiryLabel = useMemo(() => {
		if (offlineGraceExpiresAt == null) return null;
		try {
			return new Intl.DateTimeFormat(undefined, {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			}).format(new Date(offlineGraceExpiresAt));
		} catch {
			return null;
		}
	}, [offlineGraceExpiresAt]);

	const requireAuth = useCallback(() => {
		if (!canUseProtectedDiscovery) {
			setShowEmailGate(true);
			return false;
		}
		return true;
	}, [canUseProtectedDiscovery]);

	const mountTourIsland = useCallback(() => {
		if (hasMountedTourIslandRef.current) return;
		hasMountedTourIslandRef.current = true;
		setHasMountedTourIsland(true);
	}, []);

	const requestFullEvents = useCallback(() => {
		if (!fullEventsPath || hasLoadedFullEvents) {
			return Promise.resolve(events);
		}
		if (fullEventsPromiseRef.current) return fullEventsPromiseRef.current;

		const request = fetch(fullEventsPath, {
			headers: { Accept: "application/json" },
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Full events request failed: ${response.status}`);
				}
				const payload = parseFullEventsResponse(await response.json());
				if (!payload) {
					throw new Error("Full events response was not a valid event payload");
				}
				setEvents(payload);
				setHasLoadedFullEvents(true);
				return payload;
			})
			.catch((error: unknown) => {
				clientLog.warn("events-data", "Unable to hydrate full event payload", {
					error: error instanceof Error ? error.message : String(error),
				});
				fullEventsPromiseRef.current = null;
				return null;
			});

		fullEventsPromiseRef.current = request;
		return request;
	}, [events, fullEventsPath, hasLoadedFullEvents]);

	useEffect(() => {
		if (mapLoadStrategy !== "immediate") return;
		setHasMountedMapIsland(true);
		void requestFullEvents();
	}, [mapLoadStrategy, requestFullEvents]);

	const requestEventDetails = useCallback((eventKey: string) => {
		const normalizedEventKey = eventKey.trim().toLowerCase();
		const cachedRequest = eventDetailsPromiseRef.current.get(normalizedEventKey);
		if (cachedRequest) return cachedRequest;

		const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
		const request = fetch(
			`${basePath}/api/events/${encodeURIComponent(eventKey)}`,
			{
				headers: { Accept: "application/json" },
			},
		)
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Event details request failed: ${response.status}`);
				}
				const event = parseEventDetailsResponse(await response.json());
				if (!event) {
					throw new Error("Event details response was not a valid event payload");
				}
				setEvents((currentEvents) =>
					currentEvents.map((currentEvent) =>
						currentEvent.eventKey.toLowerCase() === normalizedEventKey
							? event
							: currentEvent,
					),
				);
				setSelectedEvent((currentEvent) =>
					currentEvent?.eventKey.toLowerCase() === normalizedEventKey
						? event
						: currentEvent,
				);
				return event;
			})
			.catch((error: unknown) => {
				clientLog.warn("events-data", "Unable to hydrate event details", {
					error: error instanceof Error ? error.message : String(error),
					eventKey,
				});
				eventDetailsPromiseRef.current.delete(normalizedEventKey);
				return null;
			});

		eventDetailsPromiseRef.current.set(normalizedEventKey, request);
		return request;
	}, []);

	useEffect(() => {
		let idleId: number | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const mountForTourIntent = () => {
			try {
				window.sessionStorage.setItem(PENDING_FETE_FINDER_TOUR_STORAGE_KEY, "1");
			} catch {
				// The tour can still mount; storage only preserves the start request.
			}
			mountTourIsland();
		};

		try {
			if (
				window.sessionStorage.getItem(PENDING_FETE_FINDER_TOUR_STORAGE_KEY) ===
				"1"
			) {
				mountTourIsland();
			}
		} catch {
			// Ignore unavailable session storage.
		}

		window.addEventListener(FETE_FINDER_TOUR_EVENT, mountForTourIntent);

		timeoutId = setTimeout(() => {
			if (typeof window !== "undefined" && "requestIdleCallback" in window) {
				idleId = window.requestIdleCallback(mountTourIsland, { timeout: 3000 });
				return;
			}
			mountTourIsland();
		}, 12_000);

		return () => {
			window.removeEventListener(FETE_FINDER_TOUR_EVENT, mountForTourIntent);
			if (
				idleId !== null &&
				typeof window !== "undefined" &&
				"cancelIdleCallback" in window
			) {
				window.cancelIdleCallback(idleId);
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [mountTourIsland]);

	const {
		defaultDateRange,
		selectedDateRange,
		selectedDayNightPeriods,
		selectedArrondissements,
		selectedGenres,
		selectedNationalities,
		selectedVenueTypes,
		selectedIndoorPreference,
		selectedPriceRange,
		selectedAgeRange,
		selectedOOOCPicks,
		searchQuery,
		availableArrondissements,
		availableEventDates,
		quickSelectEventDates,
		filteredEvents,
		hasAnyActiveFilters,
		activeFiltersCount,
		onDateRangeChange,
		onDayNightPeriodToggle,
		onArrondissementToggle,
		onGenreToggle,
		onNationalityToggle,
		onVenueTypeToggle,
		onIndoorPreferenceChange,
		onPriceRangeChange,
		onAgeRangeChange,
		onOOOCPicksToggle,
		onSearchQueryChange,
		onClearFilters,
	} = useEventFilters({
		events,
		requireAuth,
		isFilterAccessAllowed: canUseProtectedDiscovery,
	});
	const availableGenres = useMemo(
		() => buildAvailableGenresForEvents(events),
		[events],
	);
	const availableNationalities = useMemo(
		() => buildAvailableNationalitiesForEvents(events),
		[events],
	);

	const eventsByEventKey = useMemo(() => {
		return new Map(events.map((event) => [event.eventKey.toLowerCase(), event]));
	}, [events]);

	useEffect(() => {
		setSelectedEvent((current) => {
			if (!current) return current;
			return eventsByEventKey.get(current.eventKey.toLowerCase()) ?? current;
		});
	}, [eventsByEventKey]);

	const buildEventPath = useCallback(
		(event: Event, params = new URLSearchParams()): string => {
			const basePath = normalizeBasePath(
				process.env.NEXT_PUBLIC_BASE_PATH || "",
			);
			const encodedEventKey = encodeURIComponent(event.eventKey);
			const encodedSlug = event.slug
				? `/${encodeURIComponent(event.slug)}`
				: "";
			return appendQuery(
				`${basePath}/event/${encodedEventKey}${encodedSlug}`,
				removeLegacyEventParams(params),
			);
		},
		[],
	);

	const homePath = useCallback((params = new URLSearchParams()): string => {
		const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
		return appendQuery(basePath || "/", removeLegacyEventParams(params));
	}, []);

	const getEventKeyFromPath = useCallback((value: string): string | null => {
		const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
		const withoutBase =
			basePath && value.startsWith(`${basePath}/`)
				? value.slice(basePath.length)
				: value;
		const segments = withoutBase.split("/").filter(Boolean);
		if (segments[0] !== "event" || !segments[1]) return null;
		return decodePathSegment(segments[1]);
	}, []);

	const getCurrentUrl = useCallback(() => {
		if (typeof window !== "undefined") {
			return `${window.location.pathname}${window.location.search}`;
		}
		const current = searchParams.toString();
		return current ? `${pathname}?${current}` : pathname;
	}, [pathname, searchParams]);

	const updateUrlWithoutNavigation = useCallback(
		(
			nextUrl: string,
			mode: "push" | "replace",
			options?: { markModalEntry?: boolean },
		) => {
			if (nextUrl === getCurrentUrl()) return;

			if (typeof window !== "undefined") {
				const currentState =
					window.history.state &&
					typeof window.history.state === "object" &&
					!Array.isArray(window.history.state)
						? (window.history.state as Record<string, unknown>)
						: {};
				if (mode === "push") {
					const nextState = options?.markModalEntry
						? {
								...currentState,
								[EVENT_MODAL_HISTORY_FLAG]: true,
							}
						: currentState;
					window.history.pushState(nextState, "", nextUrl);
					return;
				}
				window.history.replaceState(currentState, "", nextUrl);
				return;
			}

			if (mode === "push") {
				router.push(nextUrl, { scroll: false });
				return;
			}
			router.replace(nextUrl, { scroll: false });
		},
		[getCurrentUrl, router],
	);

	useEffect(() => {
		const currentPathname =
			typeof window !== "undefined" ? window.location.pathname : pathname;
		const currentSearchParams =
			typeof window !== "undefined"
				? new URLSearchParams(window.location.search)
				: searchParams;
		const eventParam =
			currentSearchParams.get("event") || getEventKeyFromPath(currentPathname);
		if (!eventParam) {
			setSelectedEvent((current) => (current ? null : current));
			setIsRequestUpdateOpen(false);
			if (currentSearchParams.has(REQUEST_UPDATE_PARAM)) {
				const currentParams = new URLSearchParams(currentSearchParams.toString());
				currentParams.delete(REQUEST_UPDATE_PARAM);
				updateUrlWithoutNavigation(homePath(currentParams), "replace");
			}
			return;
		}

		const normalizedEventKey = eventParam.trim().toLowerCase();
		const resolvedEvent = eventsByEventKey.get(normalizedEventKey);
		if (!resolvedEvent) {
			invalidEventParamCountRef.current += 1;
			clientLog.warn("events-url", "Unknown event key in URL; clearing", {
				eventParam,
				invalidEventParamCount: invalidEventParamCountRef.current,
			});
			setSelectedEvent((current) => (current ? null : current));
			const currentParams = new URLSearchParams(currentSearchParams.toString());
			currentParams.delete(REQUEST_UPDATE_PARAM);
			updateUrlWithoutNavigation(homePath(currentParams), "replace");
			return;
		}

		setSelectedEvent((current) =>
			current?.eventKey === resolvedEvent.eventKey ? current : resolvedEvent,
		);
		void requestEventDetails(resolvedEvent.eventKey);
		const hasRequestUpdateParam =
			currentSearchParams.get(REQUEST_UPDATE_PARAM) === "1";
		setIsRequestUpdateOpen(hasRequestUpdateParam && eventUpdateRequestsEnabled);

		const slugParam = currentSearchParams.get("slug");
		const isLegacyQueryUrl = currentSearchParams.has("event");
		const isEventPath = getEventKeyFromPath(currentPathname) !== null;
		const currentParams = new URLSearchParams(currentSearchParams.toString());
		const hasDisabledRequestUpdateParam =
			hasRequestUpdateParam && !eventUpdateRequestsEnabled;
		if (hasDisabledRequestUpdateParam) {
			currentParams.delete(REQUEST_UPDATE_PARAM);
		}
		const canonicalEventPath = buildEventPath(resolvedEvent, currentParams);
		const canonicalEventPathname = canonicalEventPath.split("?")[0] || "";
		const hasStaleLegacySlug =
			isLegacyQueryUrl && slugParam !== resolvedEvent.slug;
		const hasStaleEventPath =
			isEventPath && currentPathname !== canonicalEventPathname;
		if (
			isLegacyQueryUrl ||
			!isEventPath ||
			hasStaleLegacySlug ||
			hasStaleEventPath ||
			hasDisabledRequestUpdateParam
		) {
			updateUrlWithoutNavigation(canonicalEventPath, "replace");
		}
	}, [
		buildEventPath,
		eventsByEventKey,
		getEventKeyFromPath,
		homePath,
		pathname,
		requestEventDetails,
		searchParams,
		updateUrlWithoutNavigation,
		eventUpdateRequestsEnabled,
	]);

	const handleEmailSubmit = useCallback(async () => {
		const hasConfirmedSession = await refreshSession();
		if (hasConfirmedSession) {
			setShowEmailGate(false);
			return true;
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 350);
		});
		const retryAfterDelay = await refreshSession();

		if (retryAfterDelay) {
			setShowEmailGate(false);
			return true;
		}
		return false;
	}, [refreshSession]);

	const toggleFilterPanel = useCallback(() => {
		if (!requireAuth()) return;
		setHasMountedFilterIsland(true);
		void requestFullEvents();
		if (
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches
		) {
			setIsFilterExpanded((previous) => !previous);
			setIsFilterOpen(false);
			return;
		}
		setIsFilterOpen((previous) => !previous);
	}, [requestFullEvents, requireAuth]);

	const toggleMapExpansion = useCallback(() => {
		setHasMountedMapIsland(true);
		void requestFullEvents();
		setIsMapExpanded((previous) => !previous);
	}, [requestFullEvents]);

	const openMap = useCallback(() => {
		setHasMountedMapIsland(true);
		void requestFullEvents();
		setIsMapExpanded(true);
	}, [requestFullEvents]);

	const openFilterPanel = useCallback(() => {
		setHasMountedFilterIsland(true);
		void requestFullEvents();
		if (
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches
		) {
			setIsFilterExpanded(true);
			setIsFilterOpen(false);
			return;
		}
		setIsFilterOpen(true);
	}, [requestFullEvents]);

	const toggleFilterExpansion = useCallback(() => {
		setIsFilterExpanded((previous) => !previous);
	}, []);

	const handleEventClick = useCallback(
		(event: Event) => {
			trackEventEngagement({
				eventKey: event.eventKey,
				actionType: "click",
				source: "event_open",
				isAuthenticated,
			});
			setSelectedEvent((current) =>
				current?.eventKey === event.eventKey ? current : event,
			);
			const currentParams =
				typeof window !== "undefined"
					? new URLSearchParams(window.location.search)
					: new URLSearchParams(searchParams.toString());
			currentParams.delete(REQUEST_UPDATE_PARAM);
			updateUrlWithoutNavigation(buildEventPath(event, currentParams), "push", {
				markModalEntry: true,
			});
		},
		[
			buildEventPath,
			isAuthenticated,
			searchParams,
			updateUrlWithoutNavigation,
		],
	);

	const handleEventClose = useCallback(() => {
		setSelectedEvent((current) => (current ? null : current));
		setIsRequestUpdateOpen(false);
		if (typeof window !== "undefined") {
			const currentState =
				window.history.state &&
				typeof window.history.state === "object" &&
				!Array.isArray(window.history.state)
					? (window.history.state as Record<string, unknown>)
					: {};
			const hasEventPath =
				getEventKeyFromPath(window.location.pathname) !== null;
			if (hasEventPath && currentState[EVENT_MODAL_HISTORY_FLAG] === true) {
				window.history.back();
				return;
			}
		}
		const currentParams =
			typeof window !== "undefined"
				? new URLSearchParams(window.location.search)
				: new URLSearchParams(searchParams.toString());
		currentParams.delete(REQUEST_UPDATE_PARAM);
		updateUrlWithoutNavigation(homePath(currentParams), "replace");
	}, [getEventKeyFromPath, homePath, searchParams, updateUrlWithoutNavigation]);

	const handleRequestUpdateOpenChange = useCallback(
		(open: boolean) => {
			setIsRequestUpdateOpen(open);
			if (!selectedEvent) return;
			const currentParams =
				typeof window !== "undefined"
					? new URLSearchParams(window.location.search)
					: new URLSearchParams(searchParams.toString());
			if (open) {
				currentParams.set(REQUEST_UPDATE_PARAM, "1");
				updateUrlWithoutNavigation(
					buildEventPath(selectedEvent, currentParams),
					"replace",
				);
				return;
			}
			currentParams.delete(REQUEST_UPDATE_PARAM);
			updateUrlWithoutNavigation(
				buildEventPath(selectedEvent, currentParams),
				"replace",
			);
		},
		[buildEventPath, searchParams, selectedEvent, updateUrlWithoutNavigation],
	);

	const scrollToAllEvents = useCallback(() => {
		allEventsRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}, []);

	const scrollToAllEventsForTour = useCallback(() => {
		setIsFilterOpen(false);
		window.requestAnimationFrame(() => {
			scrollToAllEvents();
		});
	}, [scrollToAllEvents]);

	const handleOOOCPicksCalloutClick = useCallback(() => {
		const shouldSelectOOOCPicks = !selectedOOOCPicks;
		if (shouldSelectOOOCPicks && !canUseProtectedDiscovery) {
			pendingAuthActionRef.current = "show-oooc-picks";
			setShowEmailGate(true);
			return;
		}

		onOOOCPicksToggle(shouldSelectOOOCPicks);
		void requestFullEvents();
		if (!shouldSelectOOOCPicks) return;

		window.requestAnimationFrame(() => {
			scrollToAllEvents();
		});
	}, [
		canUseProtectedDiscovery,
		onOOOCPicksToggle,
		requestFullEvents,
		scrollToAllEvents,
		selectedOOOCPicks,
	]);

	const handleSearchIntent = useCallback(
		(query: string) => {
			if (!canUseProtectedDiscovery) {
				if (query.trim().length > 0) {
					pendingAuthActionRef.current = { type: "search", query };
				}
				setShowEmailGate(true);
				return;
			}
			onSearchQueryChange(query);
			void requestFullEvents();
		},
		[canUseProtectedDiscovery, onSearchQueryChange, requestFullEvents],
	);

	const handleSearchFocus = useCallback(() => {
		if (canUseProtectedDiscovery) {
			void requestFullEvents();
			return;
		}
		setShowEmailGate(true);
	}, [canUseProtectedDiscovery, requestFullEvents]);

	useEffect(() => {
		if (!isAuthenticated) return;
		const pendingAuthAction = pendingAuthActionRef.current;
		if (!pendingAuthAction) return;

		pendingAuthActionRef.current = null;
		if (pendingAuthAction === "show-oooc-picks") {
			onOOOCPicksToggle(true);
		} else {
			onSearchQueryChange(pendingAuthAction.query);
		}
		void requestFullEvents();
		window.requestAnimationFrame(() => {
			scrollToAllEvents();
		});
	}, [
		isAuthenticated,
		onOOOCPicksToggle,
		onSearchQueryChange,
		requestFullEvents,
		scrollToAllEvents,
	]);

	const handleEmailGateClose = useCallback(() => {
		pendingAuthActionRef.current = null;
		setShowEmailGate(false);
	}, []);

	const spotlightEligibleEvents = useMemo(
		() =>
			getDiscoveryEligibleEvents(events, {
				dateRange: defaultDateRange,
			}),
		[defaultDateRange, events],
	);

	const spotlightEventsOrdered = useMemo(
		() => orderEventsForDiscoverySurface(spotlightEligibleEvents, sortMode),
		[sortMode, spotlightEligibleEvents],
	);

	const allEventsOrdered = useMemo(
		() => orderEventsForDiscoverySurface(filteredEvents, sortMode),
		[filteredEvents, sortMode],
	);

	const socialProofDisplayModes = useMemo(
		() => getSocialProofDisplayModes(spotlightEligibleEvents),
		[spotlightEligibleEvents],
	);
	const ooocPicksInViewCount = useMemo(
		() => filteredEvents.filter((event) => event.isOOOCPick === true).length,
		[filteredEvents],
	);
	const searchSlot = (
		<div id="tour-search" className="w-full">
			<SearchBar
				onSearch={handleSearchIntent}
				onSearchFocus={handleSearchFocus}
				placeholder="Search events, locations, genres, phases..."
				className="mx-auto w-full max-w-[64rem]"
				value={searchQuery}
				resultsCount={filteredEvents.length}
				showResultsCount
				resultsCountLabelMode={hasAnyActiveFilters ? "found" : "available"}
				dynamicChips={dynamicSearchChips}
			/>
		</div>
	);

	return (
		<>
			<section className="mb-8" aria-label="Introduction">
				<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-end">
					<div className="min-w-0">
						<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
							Paris · Fête de la Musique
						</p>
						<h2
							className="mt-2 text-2xl font-light tracking-tight text-foreground sm:text-3xl"
							style={{ fontFamily: "var(--ooo-font-display)" }}
						>
							Discover events across the city
						</h2>
						<p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
							Explore live music and cultural events by arrondissement. Use the
							map and filters to find what’s on.
						</p>
						<Link
							href="/how-it-works"
							className="mt-3 inline-flex flex-wrap items-baseline gap-x-1 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-foreground/78 hover:underline"
						>
							<span>New here? See how Fête Finder</span>
							<span className="whitespace-nowrap">works →</span>
						</Link>
					</div>
					{ooocPicksInViewCount > 0 && (
						<div
							id="tour-oooc-picks"
							className="ooo-site-card-soft w-full rounded-xl border border-border/70 bg-background/62 p-3 shadow-sm lg:justify-self-end"
						>
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
										OOOC Picks
									</p>
									<p className="mt-1 text-xs leading-relaxed text-foreground/80">
										Short on time? Start with the community-curated favourites.
									</p>
								</div>
								<Button
									type="button"
									variant={selectedOOOCPicks ? "default" : "outline"}
									size="sm"
									onClick={handleOOOCPicksCalloutClick}
									className="h-8 shrink-0 rounded-full px-3 text-xs"
								>
									{selectedOOOCPicks ? "Showing Picks" : "Show Picks"}
								</Button>
							</div>
						</div>
					)}
				</div>
				<div className="mt-6 border-t border-border" role="presentation" />
			</section>

			{authMode === "offline-grace" && (
				<div className="mb-6 rounded-md border border-amber-300/70 bg-amber-50/85 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-200">
					<p className="text-[11px] uppercase tracking-[0.14em] text-amber-800/85 dark:text-amber-200/85">
						Offline Access
					</p>
					<p className="mt-1 leading-relaxed">
						You are using temporary offline access for filters and search
						{offlineGraceExpiryLabel ? ` until ${offlineGraceExpiryLabel}` : ""}
						. Reconnect to refresh your session.
					</p>
				</div>
			)}

			{isAuthResolved && !isAuthenticated && !isOnline && (
				<div className="mb-6 rounded-md border border-border/70 bg-background/75 px-4 py-3 text-sm text-muted-foreground">
					<p className="text-[11px] uppercase tracking-[0.14em] text-foreground/75">
						Offline & Signed Out
					</p>
					<p className="mt-1 leading-relaxed">
						Reconnect to unlock filters and search.
					</p>
				</div>
			)}

			<FeaturedEvents
				events={spotlightEventsOrdered}
				onEventClick={handleEventClick}
				onScrollToAllEvents={scrollToAllEvents}
				socialProofDisplayModes={socialProofDisplayModes}
				dateRange={defaultDateRange}
			/>

			<EventStats
				filteredEvents={filteredEvents}
				hasActiveFilters={hasAnyActiveFilters}
			/>

			<div
				id="event-map"
				className="scroll-mt-6 mb-8 relative z-10 sm:scroll-mt-28"
			>
				{hasMountedMapIsland ? (
					<Suspense
						fallback={
							<DeferredMapShell
								eventsCount={filteredEvents.length}
								isExpanded={isMapExpanded}
								onOpen={openMap}
								hasActiveFilters={hasAnyActiveFilters}
								activeFiltersCount={activeFiltersCount}
							/>
						}
					>
						<EventsMapCard
							events={filteredEvents}
							isExpanded={isMapExpanded}
							onToggleExpanded={toggleMapExpansion}
							onEventClick={handleEventClick}
							mapLoadStrategy={mapLoadStrategy}
							onFilterClick={toggleFilterPanel}
							onMapIntent={() => {
								void requestFullEvents();
							}}
							hasActiveFilters={hasAnyActiveFilters}
							activeFiltersCount={activeFiltersCount}
						/>
					</Suspense>
				) : (
					<DeferredMapShell
						eventsCount={filteredEvents.length}
						isExpanded={isMapExpanded}
						onOpen={openMap}
						hasActiveFilters={hasAnyActiveFilters}
						activeFiltersCount={activeFiltersCount}
					/>
				)}
			</div>

			<div
				id="all-events"
				className="scroll-mt-6 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start lg:gap-5 sm:scroll-mt-28"
			>
				<aside className="lg:sticky lg:top-30 lg:self-start">
					{hasMountedFilterIsland ? (
						<Suspense
							fallback={
								<DeferredFilterShell
									onOpen={openFilterPanel}
									hasActiveFilters={hasAnyActiveFilters}
									activeFiltersCount={activeFiltersCount}
									canUseProtectedDiscovery={canUseProtectedDiscovery}
									onAuthRequired={() => setShowEmailGate(true)}
								/>
							}
						>
							<AuthGate
								isAuthenticated={canUseProtectedDiscovery}
								isAuthResolved={isAuthResolved}
								onAuthRequired={() => setShowEmailGate(true)}
								className="min-h-0"
								variant="filter-preview"
							>
								<FilterPanel
									selectedDateRange={selectedDateRange}
									defaultDateRange={defaultDateRange}
									selectedDayNightPeriods={selectedDayNightPeriods}
									selectedArrondissements={selectedArrondissements}
									selectedGenres={selectedGenres}
									selectedNationalities={selectedNationalities}
									selectedVenueTypes={selectedVenueTypes}
									selectedIndoorPreference={selectedIndoorPreference}
									selectedPriceRange={selectedPriceRange}
									selectedAgeRange={selectedAgeRange}
									selectedOOOCPicks={selectedOOOCPicks}
									onDateRangeChange={onDateRangeChange}
									onDayNightPeriodToggle={onDayNightPeriodToggle}
									onArrondissementToggle={onArrondissementToggle}
									onGenreToggle={onGenreToggle}
									onNationalityToggle={onNationalityToggle}
									onVenueTypeToggle={onVenueTypeToggle}
									onIndoorPreferenceChange={onIndoorPreferenceChange}
									onPriceRangeChange={onPriceRangeChange}
									onAgeRangeChange={onAgeRangeChange}
									onOOOCPicksToggle={onOOOCPicksToggle}
									onClearFilters={onClearFilters}
									availableArrondissements={availableArrondissements}
									availableGenres={availableGenres}
									availableNationalities={availableNationalities}
									availableEventDates={availableEventDates}
									quickSelectEventDates={quickSelectEventDates}
									filteredEventsCount={filteredEvents.length}
									isOpen={isFilterOpen}
									onClose={() => setIsFilterOpen(false)}
									onOpen={openFilterPanel}
									isExpanded={isFilterExpanded}
									onToggleExpanded={toggleFilterExpansion}
									hideFloatingButton={!canUseProtectedDiscovery}
								/>
							</AuthGate>
						</Suspense>
					) : (
						<DeferredFilterShell
							onOpen={openFilterPanel}
							hasActiveFilters={hasAnyActiveFilters}
							activeFiltersCount={activeFiltersCount}
							canUseProtectedDiscovery={canUseProtectedDiscovery}
							onAuthRequired={() => setShowEmailGate(true)}
						/>
					)}
				</aside>

				<div
					id="tour-all-events"
					className="min-w-0 scroll-mt-6 sm:scroll-mt-28"
				>
					<AllEvents
						key={`${sortMode}:${searchQuery}:${activeFiltersCount}:${allEventsOrdered.length}:${allEventsOrdered[0]?.eventKey ?? ""}:${allEventsOrdered.at(-1)?.eventKey ?? ""}`}
						ref={allEventsRef}
						events={allEventsOrdered}
						onEventClick={handleEventClick}
						socialProofDisplayModes={socialProofDisplayModes}
						sortMode={sortMode}
						onSortModeChange={setSortMode}
						onFilterClickAction={toggleFilterPanel}
						onClearFilters={onClearFilters}
						onAuthRequired={() => setShowEmailGate(true)}
						hasActiveFilters={hasAnyActiveFilters}
						activeFiltersCount={activeFiltersCount}
						isAuthenticated={canUseProtectedDiscovery}
						isAuthResolved={isAuthResolved}
						searchSlot={searchSlot}
					/>
				</div>
			</div>

			{selectedEvent && (
				<EventModal
					event={selectedEvent}
					isOpen
					onClose={handleEventClose}
					isAuthenticated={isAuthenticated}
					submissionsEnabled={eventUpdateRequestsEnabled}
					isRequestUpdateOpen={isRequestUpdateOpen}
					onRequestUpdateOpenChange={handleRequestUpdateOpenChange}
					socialProofMode={socialProofDisplayModes.get(selectedEvent.eventKey)}
				/>
			)}

			{showEmailGate && (
				<Suspense fallback={NoopSuspenseFallback}>
					<EmailGateModal
						isOpen={showEmailGate}
						onClose={handleEmailGateClose}
						onEmailSubmit={handleEmailSubmit}
					/>
				</Suspense>
			)}

			<ScrollToTopButton
				mobileDock="stacked-with-filter"
				className="hidden lg:inline-flex"
			/>
			{hasMountedTourIsland && (
				<Suspense fallback={NoopSuspenseFallback}>
					<FeteFinderTour
						isAuthenticated={isAuthenticated}
						isAuthResolved={isAuthResolved}
						onAuthRequired={() => setShowEmailGate(true)}
						onFilterClose={() => setIsFilterOpen(false)}
						onFilterOpen={openFilterPanel}
						onMapExpand={openMap}
						onScrollToAllEvents={scrollToAllEventsForTour}
					/>
				</Suspense>
			)}
		</>
	);
}
