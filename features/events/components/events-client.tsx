"use client";

import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { AuthGatedControlsIsland } from "@/features/events/components/AuthGatedControlsIsland";
import { EventListIsland } from "@/features/events/components/EventListIsland";
import { EventModalIsland } from "@/features/events/components/EventModalIsland";
import { EventsDataStatusBanner } from "@/features/events/components/EventsDataStatusBanner";
import { EventsDiscoverySummaryIsland } from "@/features/events/components/EventsDiscoverySummaryIsland";
import { EventsMapIsland } from "@/features/events/components/EventsMapIsland";
import { EventsSearchFiltersIsland } from "@/features/events/components/EventsSearchFiltersIsland";
import { OfflineDebugPanel } from "@/features/events/components/OfflineDebugPanel";
import {
	EventsOfflineProvider,
	useEventsOffline,
} from "@/features/events/components/events-offline-provider";
import { useEventsSearchFilters } from "@/features/events/components/events-search-filters-provider";
import { useEventDetailHydration } from "@/features/events/components/use-event-detail-hydration";
import { trackEventEngagement } from "@/features/events/engagement/client-tracking";
import type { SpotlightRotationContext } from "@/features/events/featured/selection";
import type { SearchChip } from "@/features/events/search-chips";
import {
	FETE_FINDER_TOUR_EVENT,
	PENDING_FETE_FINDER_TOUR_STORAGE_KEY,
	shouldSuppressFeteFinderTourPrompt,
} from "@/features/events/tour-events";
import type { Event } from "@/features/events/types";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { HomePlanRoutePrompt } from "@/features/plans/components/HomePlanRoutePrompt";
import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import { clientLog } from "@/lib/platform/client-logger";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type RefObject,
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
	mapLoadStrategy: MapLoadStrategy;
	eventUpdateRequestsEnabled?: boolean;
	dynamicSearchChips?: SearchChip[];
	spotlightRotationContext: SpotlightRotationContext;
}

const EVENT_MODAL_HISTORY_FLAG = "__ooocEventModalHistory";
const MAP_VIEW_PARAM = "map";
const MAP_VIEW_FULLSCREEN = "fullscreen";
const REQUEST_UPDATE_PARAM = "requestUpdate";

const FeteFinderTour = lazy(async () => {
	const module = await import("@/features/events/components/FeteFinderTour");
	return { default: module.FeteFinderTour };
});

const NoopSuspenseFallback = (
	<span className="sr-only" aria-hidden="true">
		Loading
	</span>
);

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

export function EventsClient({
	initialEvents,
	mapLoadStrategy,
	eventUpdateRequestsEnabled = true,
	dynamicSearchChips = [],
	spotlightRotationContext,
}: EventsClientProps) {
	return (
		<EventsOfflineProvider initialEvents={initialEvents}>
			<AuthGatedControlsIsland
				spotlightRotationContext={spotlightRotationContext}
			>
				{(authControls) => (
					<EventsClientShell
						{...authControls}
						dynamicSearchChips={dynamicSearchChips}
						eventUpdateRequestsEnabled={eventUpdateRequestsEnabled}
						mapLoadStrategy={mapLoadStrategy}
					/>
				)}
			</AuthGatedControlsIsland>
		</EventsOfflineProvider>
	);
}

interface EventsClientShellProps {
	mapLoadStrategy: MapLoadStrategy;
	eventUpdateRequestsEnabled: boolean;
	dynamicSearchChips: SearchChip[];
}

interface EventsClientShellInnerProps extends EventsClientShellProps {
	allEventsRef: RefObject<HTMLDivElement | null>;
	authMode: string;
	canUseProtectedDiscovery: boolean;
	isAuthenticated: boolean;
	isAuthResolved: boolean;
	isOnline: boolean;
	onAuthRequired: () => void;
	offlineGraceExpiresAt: number | null;
}

function EventsClientShell({
	allEventsRef,
	authMode,
	canUseProtectedDiscovery,
	dynamicSearchChips,
	eventUpdateRequestsEnabled,
	isAuthResolved,
	isAuthenticated,
	isOnline,
	mapLoadStrategy,
	onAuthRequired,
	offlineGraceExpiresAt,
}: EventsClientShellInnerProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const requestedMapView = searchParams.get(MAP_VIEW_PARAM);
	const { eventDataSource, events, setEvents } = useEventsOffline();
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [fullscreenMapOpenRequest, setFullscreenMapOpenRequest] = useState(0);
	const [isMapExpanded, setIsMapExpanded] = useState(false);
	const [isRequestUpdateOpen, setIsRequestUpdateOpen] = useState(false);
	const [hasMountedTourIsland, setHasMountedTourIsland] = useState(false);
	const invalidEventParamCountRef = useRef(0);
	const consumedMapIntentRef = useRef<string | null>(null);
	const hasMountedTourIslandRef = useRef(false);
	const { settings: localAppSettings, isLoaded: areLocalSettingsLoaded } =
		useLocalAppSettings();
	const { openFilterPanel, setIsFilterOpen } = useEventsSearchFilters();
	const requestEventDetails = useEventDetailHydration({
		setEvents,
		setSelectedEvent,
	});

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
	const effectiveMapLoadStrategy: MapLoadStrategy =
		mapLoadStrategy === "immediate"
			? "immediate"
			: areLocalSettingsLoaded
				? localAppSettings.mapLoadStrategy
				: "expand";

	const mountTourIsland = useCallback(() => {
		if (hasMountedTourIslandRef.current) return;
		hasMountedTourIslandRef.current = true;
		setHasMountedTourIsland(true);
	}, []);

	useEffect(() => {
		if (!isAuthResolved || !isAuthenticated || hasMountedTourIsland) return;
		if (shouldSuppressFeteFinderTourPrompt()) return;
		mountTourIsland();
	}, [hasMountedTourIsland, isAuthResolved, isAuthenticated, mountTourIsland]);

	useEffect(() => {
		if (!isOnline) return;

		const mountForTourIntent = () => {
			try {
				window.sessionStorage.setItem(
					PENDING_FETE_FINDER_TOUR_STORAGE_KEY,
					"1",
				);
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

		return () => {
			window.removeEventListener(FETE_FINDER_TOUR_EVENT, mountForTourIntent);
		};
	}, [isOnline, mountTourIsland]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (requestedMapView !== MAP_VIEW_FULLSCREEN) return;

		const currentParams = new URLSearchParams(window.location.search);

		const currentIntent = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (consumedMapIntentRef.current === currentIntent) return;
		consumedMapIntentRef.current = currentIntent;

		setIsMapExpanded(true);
		setFullscreenMapOpenRequest((current) => current + 1);

		currentParams.delete(MAP_VIEW_PARAM);
		const nextQuery = currentParams.toString();
		const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
		window.history.replaceState(window.history.state, "", nextUrl);
	}, [requestedMapView]);

	const eventsByEventKey = useMemo(() => {
		return new Map(
			events.map((event) => [event.eventKey.toLowerCase(), event]),
		);
	}, [events]);
	const selectedSeriesEvents = useMemo(() => {
		if (!selectedEvent?.seriesKey) return [];
		return events
			.filter((event) => event.seriesKey === selectedEvent.seriesKey)
			.sort((left, right) => left.date.localeCompare(right.date));
	}, [events, selectedEvent?.seriesKey]);

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
				const currentParams = new URLSearchParams(
					currentSearchParams.toString(),
				);
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
		if (eventDataSource === "saved") {
			void requestEventDetails(resolvedEvent.eventKey);
		}
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
		eventDataSource,
		eventsByEventKey,
		getEventKeyFromPath,
		homePath,
		pathname,
		requestEventDetails,
		searchParams,
		updateUrlWithoutNavigation,
		eventUpdateRequestsEnabled,
	]);

	const toggleMapExpansion = useCallback(() => {
		setIsMapExpanded((previous) => !previous);
	}, []);

	const openMap = useCallback(() => {
		setIsMapExpanded(true);
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
		[buildEventPath, isAuthenticated, searchParams, updateUrlWithoutNavigation],
	);
	const handleSeriesEventNavigate = useCallback(
		(event: Event) => {
			setSelectedEvent((current) =>
				current?.eventKey === event.eventKey ? current : event,
			);
			const currentParams =
				typeof window !== "undefined"
					? new URLSearchParams(window.location.search)
					: new URLSearchParams(searchParams.toString());
			currentParams.delete(REQUEST_UPDATE_PARAM);
			updateUrlWithoutNavigation(
				buildEventPath(event, currentParams),
				"replace",
			);
			if (eventDataSource === "saved") {
				void requestEventDetails(event.eventKey);
			}
		},
		[
			buildEventPath,
			eventDataSource,
			requestEventDetails,
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
	}, [allEventsRef]);

	const scrollToAllEventsForTour = useCallback(() => {
		setIsFilterOpen(false);
		window.requestAnimationFrame(() => {
			scrollToAllEvents();
		});
	}, [scrollToAllEvents, setIsFilterOpen]);

	return (
		<>
			<EventsDataStatusBanner
				offlineGraceExpiryLabel={offlineGraceExpiryLabel}
				showOfflineGraceAccess={authMode === "offline-grace"}
			/>
			<OfflineDebugPanel />

			{authMode === "offline-grace" && eventDataSource !== "saved" && (
				<div className="mb-6 rounded-md border border-amber-300/70 bg-amber-50/85 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-200">
					<p className="text-[11px] uppercase tracking-[0.14em] text-amber-800/85 dark:text-amber-200/85">
						Cached Access
					</p>
					<p className="mt-1 leading-relaxed">
						You are using temporary cached access for filters and search
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

			<EventsDiscoverySummaryIsland
				onEventClick={handleEventClick}
				onScrollToAllEvents={scrollToAllEvents}
			/>

			<EventsMapIsland
				fullscreenOpenRequest={fullscreenMapOpenRequest}
				isExpanded={isMapExpanded}
				mapLoadStrategy={effectiveMapLoadStrategy}
				onToggleExpanded={toggleMapExpansion}
				onEventClick={handleEventClick}
			/>

			<EventsSearchFiltersIsland
				canUseProtectedDiscovery={canUseProtectedDiscovery}
				dynamicSearchChips={dynamicSearchChips}
				isAuthResolved={isAuthResolved}
				onAuthRequired={onAuthRequired}
			>
				{(searchSlot) => (
					<EventListIsland
						allEventsRef={allEventsRef}
						onEventClick={handleEventClick}
						onAuthRequired={onAuthRequired}
						isAuthenticated={canUseProtectedDiscovery}
						isAuthResolved={isAuthResolved}
						searchSlot={searchSlot}
					/>
				)}
			</EventsSearchFiltersIsland>

			<EventModalIsland
				event={selectedEvent}
				isAuthenticated={isAuthenticated}
				submissionsEnabled={eventUpdateRequestsEnabled}
				isRequestUpdateOpen={isRequestUpdateOpen}
				onClose={handleEventClose}
				onRequestUpdateOpenChange={handleRequestUpdateOpenChange}
				seriesEvents={selectedSeriesEvents}
				onNavigateSeriesEvent={handleSeriesEventNavigate}
			/>

			<HomePlanRoutePrompt events={events} />

			<ScrollToTopButton
				mobileDock="stacked-with-filter"
				className="hidden lg:inline-flex"
			/>
			{hasMountedTourIsland && (
				<Suspense fallback={NoopSuspenseFallback}>
					<FeteFinderTour
						isAuthenticated={isAuthenticated}
						isAuthResolved={isAuthResolved}
						onAuthRequired={onAuthRequired}
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
