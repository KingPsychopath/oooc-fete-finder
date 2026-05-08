"use client";

import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import AuthGate from "@/features/auth/components/AuthGate";
import EmailGateModal from "@/features/auth/components/EmailGateModal";
import { AllEvents } from "@/features/events/components/AllEvents";
import EventModal from "@/features/events/components/EventModal";
import EventStats from "@/features/events/components/EventStats";
import { FeteFinderTour } from "@/features/events/components/FeteFinderTour";
import FilterPanel from "@/features/events/components/FilterPanel";
import SearchBar from "@/features/events/components/SearchBar";
import { getCountryOption } from "@/features/events/countries";
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
import { getSocialProofDisplayModes } from "@/features/events/social-proof";
import {
	type Event,
	MUSIC_GENRES,
	type MusicGenreDefinition,
	type Nationality,
} from "@/features/events/types";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { EventsMapCard } from "@/features/maps/components/events-map-card";
import { clientLog } from "@/lib/platform/client-logger";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface EventsClientProps {
	initialEvents: Event[];
	mapLoadStrategy: MapLoadStrategy;
	eventUpdateRequestsEnabled?: boolean;
}

const EVENT_MODAL_HISTORY_FLAG = "__ooocEventModalHistory";
const REQUEST_UPDATE_PARAM = "requestUpdate";
type EventSortMode = "upcoming" | "fresh-activity";
type PendingAuthAction = "show-oooc-picks";

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
	mapLoadStrategy,
	eventUpdateRequestsEnabled = true,
}: EventsClientProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isMapExpanded, setIsMapExpanded] = useState(false);
	const [isFilterExpanded, setIsFilterExpanded] = useState(false);
	const [isAllEventsHeaderVisible, setIsAllEventsHeaderVisible] =
		useState(false);
	const [showEmailGate, setShowEmailGate] = useState(false);
	const [isRequestUpdateOpen, setIsRequestUpdateOpen] = useState(false);
	const [sortMode, setSortMode] = useState<EventSortMode>("upcoming");
	const pendingAuthActionRef = useRef<PendingAuthAction | null>(null);
	const invalidEventParamCountRef = useRef(0);
	const allEventsRef = useRef<HTMLDivElement>(null);
	const {
		isAuthenticated,
		isAuthResolved,
		isOnline,
		authMode,
		offlineGraceExpiresAt,
		refreshSession,
	} = useAuth();

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
		if (!isAuthenticated) {
			setShowEmailGate(true);
			return false;
		}
		return true;
	}, [isAuthenticated]);

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
		events: initialEvents,
		requireAuth,
		isFilterAccessAllowed: isAuthenticated || authMode === "offline-grace",
	});
	const availableGenres = useMemo(
		() => buildAvailableGenresForEvents(initialEvents),
		[initialEvents],
	);
	const availableNationalities = useMemo(
		() => buildAvailableNationalitiesForEvents(initialEvents),
		[initialEvents],
	);

	const eventsByEventKey = useMemo(() => {
		return new Map(
			initialEvents.map((event) => [event.eventKey.toLowerCase(), event]),
		);
	}, [initialEvents]);

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
		const eventParam =
			searchParams.get("event") || getEventKeyFromPath(pathname);
		if (!eventParam) {
			setSelectedEvent((current) => (current ? null : current));
			setIsRequestUpdateOpen(false);
			if (searchParams.has(REQUEST_UPDATE_PARAM)) {
				const currentParams = new URLSearchParams(searchParams.toString());
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
			const currentParams = new URLSearchParams(searchParams.toString());
			currentParams.delete(REQUEST_UPDATE_PARAM);
			updateUrlWithoutNavigation(homePath(currentParams), "replace");
			return;
		}

		setSelectedEvent((current) =>
			current?.eventKey === resolvedEvent.eventKey ? current : resolvedEvent,
		);
		const hasRequestUpdateParam =
			searchParams.get(REQUEST_UPDATE_PARAM) === "1";
		setIsRequestUpdateOpen(hasRequestUpdateParam && eventUpdateRequestsEnabled);

		const slugParam = searchParams.get("slug");
		const isLegacyQueryUrl = searchParams.has("event");
		const isEventPath = getEventKeyFromPath(pathname) !== null;
		const currentParams = new URLSearchParams(searchParams.toString());
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
			isEventPath && pathname !== canonicalEventPathname;
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
		setIsFilterOpen((previous) => !previous);
	}, [requireAuth]);

	const toggleMapExpansion = useCallback(() => {
		setIsMapExpanded((previous) => !previous);
	}, []);

	const openMap = useCallback(() => {
		setIsMapExpanded(true);
	}, []);

	const openFilterPanel = useCallback(() => {
		setIsFilterOpen(true);
	}, []);

	const toggleFilterExpansion = useCallback(() => {
		setIsFilterExpanded((previous) => !previous);
	}, []);

	useEffect(() => {
		if (typeof IntersectionObserver === "undefined") return;
		const allEventsElement = allEventsRef.current;
		if (!allEventsElement) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsAllEventsHeaderVisible(entry.isIntersecting);
			},
			{
				rootMargin: "-8% 0px -58% 0px",
				threshold: 0,
			},
		);
		observer.observe(allEventsElement);

		return () => {
			observer.disconnect();
		};
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
		if (shouldSelectOOOCPicks && !isAuthenticated) {
			pendingAuthActionRef.current = "show-oooc-picks";
			setShowEmailGate(true);
			return;
		}

		onOOOCPicksToggle(shouldSelectOOOCPicks);
		if (!shouldSelectOOOCPicks) return;

		window.requestAnimationFrame(() => {
			scrollToAllEvents();
		});
	}, [
		isAuthenticated,
		onOOOCPicksToggle,
		scrollToAllEvents,
		selectedOOOCPicks,
	]);

	useEffect(() => {
		if (!isAuthenticated) return;
		if (pendingAuthActionRef.current !== "show-oooc-picks") return;

		pendingAuthActionRef.current = null;
		onOOOCPicksToggle(true);
		window.requestAnimationFrame(() => {
			scrollToAllEvents();
		});
	}, [isAuthenticated, onOOOCPicksToggle, scrollToAllEvents]);

	const handleEmailGateClose = useCallback(() => {
		pendingAuthActionRef.current = null;
		setShowEmailGate(false);
	}, []);

	const allEventsOrdered = useMemo(() => {
		const featuredMatches: Event[] = [];
		const promotedMatches: Event[] = [];
		const regularMatches: Event[] = [];
		const now = new Date();
		const regularEventsComparator =
			sortMode === "fresh-activity"
				? createFreshActivityComparator(now)
				: createRegularEventsComparator(now);

		for (const event of filteredEvents) {
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

		const sortedRegularMatches = [...regularMatches].sort(
			regularEventsComparator,
		);

		return [...featuredMatches, ...promotedMatches, ...sortedRegularMatches];
	}, [filteredEvents, sortMode]);

	const socialProofDisplayModes = useMemo(
		() => getSocialProofDisplayModes(filteredEvents),
		[filteredEvents],
	);
	const ooocPicksInViewCount = useMemo(
		() => filteredEvents.filter((event) => event.isOOOCPick === true).length,
		[filteredEvents],
	);

	return (
		<>
			<div className="mb-8">
				<AuthGate
					isAuthenticated={isAuthenticated}
					isAuthResolved={isAuthResolved}
					onAuthRequired={() => setShowEmailGate(true)}
					className="min-h-[120px] flex items-center"
				>
					<div id="tour-search">
						<SearchBar
							onSearch={onSearchQueryChange}
							placeholder="Search events, locations, genres, phases..."
							className="max-w-md mx-auto"
							value={searchQuery}
							resultsCount={filteredEvents.length}
							showResultsCount
							resultsCountLabelMode={
								hasAnyActiveFilters ? "found" : "available"
							}
						/>
					</div>
				</AuthGate>
				{ooocPicksInViewCount > 0 && (
					<div
						id="tour-oooc-picks"
						className="mx-auto mt-3 flex max-w-md flex-col gap-2 rounded-md border border-border/65 bg-background/55 px-3 py-2 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
					>
						<div className="min-w-0">
							<p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
								OOOC Picks
							</p>
							<p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
								Short on time? Start with the community-curated favourites.
							</p>
						</div>
						<Button
							type="button"
							variant={selectedOOOCPicks ? "default" : "outline"}
							size="sm"
							onClick={handleOOOCPicksCalloutClick}
							className="h-8 w-full shrink-0 px-3 text-xs sm:w-auto"
						>
							{selectedOOOCPicks ? "Showing Picks" : "Show All Picks"}
						</Button>
					</div>
				)}
			</div>

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
				events={allEventsOrdered}
				onEventClick={handleEventClick}
				onScrollToAllEvents={scrollToAllEvents}
				socialProofDisplayModes={socialProofDisplayModes}
				dateRange={selectedDateRange}
			/>

			<EventStats
				filteredEvents={filteredEvents}
				hasActiveFilters={hasAnyActiveFilters}
			/>

			<div
				id="event-map"
				className="scroll-mt-6 mb-8 relative z-10 sm:scroll-mt-28"
			>
				<EventsMapCard
					events={filteredEvents}
					isExpanded={isMapExpanded}
					onToggleExpanded={toggleMapExpansion}
					onEventClick={handleEventClick}
					mapLoadStrategy={mapLoadStrategy}
					onFilterClick={toggleFilterPanel}
					hasActiveFilters={hasAnyActiveFilters}
					activeFiltersCount={activeFiltersCount}
				/>
			</div>

			<div className="mb-8">
				<AuthGate
					isAuthenticated={isAuthenticated}
					isAuthResolved={isAuthResolved}
					onAuthRequired={() => setShowEmailGate(true)}
					className="min-h-[400px]"
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
						hideFloatingButton={isAllEventsHeaderVisible}
					/>
				</AuthGate>
			</div>

			<div id="all-events" className="scroll-mt-6 sm:scroll-mt-28">
				<div id="tour-all-events" className="scroll-mt-6 sm:scroll-mt-28">
					<AllEvents
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
						isAuthenticated={isAuthenticated}
						isAuthResolved={isAuthResolved}
					/>
				</div>
			</div>

			<EventModal
				event={selectedEvent}
				isOpen={selectedEvent !== null}
				onClose={handleEventClose}
				isAuthenticated={isAuthenticated}
				submissionsEnabled={eventUpdateRequestsEnabled}
				isRequestUpdateOpen={isRequestUpdateOpen}
				onRequestUpdateOpenChange={handleRequestUpdateOpenChange}
				socialProofMode={
					selectedEvent
						? socialProofDisplayModes.get(selectedEvent.eventKey)
						: undefined
				}
			/>

			<EmailGateModal
				isOpen={showEmailGate}
				onClose={handleEmailGateClose}
				onEmailSubmit={handleEmailSubmit}
			/>

			<ScrollToTopButton
				mobileDock="stacked-with-filter"
				className="hidden lg:inline-flex"
			/>
			<FeteFinderTour
				isAuthenticated={isAuthenticated}
				isAuthResolved={isAuthResolved}
				onAuthRequired={() => setShowEmailGate(true)}
				onFilterClose={() => setIsFilterOpen(false)}
				onFilterOpen={openFilterPanel}
				onMapExpand={openMap}
				onScrollToAllEvents={scrollToAllEventsForTour}
			/>
		</>
	);
}
