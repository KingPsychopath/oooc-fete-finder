"use client";

import { ScrollToTopButton } from "@/components/ScrollToTopButton";
import { useAuth } from "@/features/auth/auth-context";
import AuthGate from "@/features/auth/components/AuthGate";
import EmailGateModal from "@/features/auth/components/EmailGateModal";
import { AllEvents } from "@/features/events/components/AllEvents";
import EventModal from "@/features/events/components/EventModal";
import EventStats from "@/features/events/components/EventStats";
import FilterPanel from "@/features/events/components/FilterPanel";
import SearchBar from "@/features/events/components/SearchBar";
import { FeaturedEvents } from "@/features/events/featured/FeaturedEvents";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import { useEventFilters } from "@/features/events/hooks/use-event-filters";
import type { Event } from "@/features/events/types";
import type { MapLoadStrategy } from "@/features/maps/components/events-map-card";
import { EventsMapCard } from "@/features/maps/components/events-map-card";
import { clientLog } from "@/lib/platform/client-logger";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface EventsClientProps {
	initialEvents: Event[];
	mapLoadStrategy: MapLoadStrategy;
}

const EVENT_MODAL_HISTORY_FLAG = "__ooocEventModalHistory";

export function EventsClient({
	initialEvents,
	mapLoadStrategy,
}: EventsClientProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
	const [isFilterOpen, setIsFilterOpen] = useState(false);
	const [isMapExpanded, setIsMapExpanded] = useState(false);
	const [isFilterExpanded, setIsFilterExpanded] = useState(false);
	const [showEmailGate, setShowEmailGate] = useState(false);
	const invalidEventParamCountRef = useRef(0);
	const allEventsRef = useRef<HTMLDivElement>(null);
	const {
		isAuthenticated,
		isAuthResolved,
		isOnline,
		authMode,
		offlineGraceExpiresAt,
		authenticate,
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
	});

	const eventsByEventKey = useMemo(() => {
		return new Map(
			initialEvents.map((event) => [event.eventKey.toLowerCase(), event]),
		);
	}, [initialEvents]);

	const buildUrlFromParams = useCallback(
		(params: URLSearchParams) => {
			const basePath =
				typeof window !== "undefined" ? window.location.pathname : pathname;
			const query = params.toString();
			return query ? `${basePath}?${query}` : basePath;
		},
		[pathname],
	);

	const createUrlForEventState = useCallback(
		(event: Event | null) => {
			const params =
				typeof window !== "undefined"
					? new URLSearchParams(window.location.search)
					: new URLSearchParams(searchParams.toString());
			if (!event) {
				params.delete("event");
				params.delete("slug");
			} else {
				params.set("event", event.eventKey);
				params.set("slug", event.slug);
			}
			return buildUrlFromParams(params);
		},
		[buildUrlFromParams, searchParams],
	);

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
		const eventParam = searchParams.get("event");
		if (!eventParam) {
			setSelectedEvent((current) => (current ? null : current));
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
			updateUrlWithoutNavigation(createUrlForEventState(null), "replace");
			return;
		}

		setSelectedEvent((current) =>
			current?.eventKey === resolvedEvent.eventKey ? current : resolvedEvent,
		);

		const slugParam = searchParams.get("slug");
		if (slugParam !== resolvedEvent.slug) {
			updateUrlWithoutNavigation(
				createUrlForEventState(resolvedEvent),
				"replace",
			);
		}
	}, [
		createUrlForEventState,
		eventsByEventKey,
		searchParams,
		updateUrlWithoutNavigation,
	]);

	const handleEmailSubmit = useCallback(
		(email: string) => {
			authenticate(email);
			setShowEmailGate(false);
		},
		[authenticate],
	);

	const toggleFilterPanel = useCallback(() => {
		if (!requireAuth()) return;
		setIsFilterOpen((previous) => !previous);
	}, [requireAuth]);

	const toggleMapExpansion = useCallback(() => {
		setIsMapExpanded((previous) => !previous);
	}, []);

	const toggleFilterExpansion = useCallback(() => {
		setIsFilterExpanded((previous) => !previous);
	}, []);

	const handleEventClick = useCallback(
		(event: Event) => {
			setSelectedEvent((current) =>
				current?.eventKey === event.eventKey ? current : event,
			);
			updateUrlWithoutNavigation(createUrlForEventState(event), "push", {
				markModalEntry: true,
			});
		},
		[createUrlForEventState, updateUrlWithoutNavigation],
	);

	const handleEventClose = useCallback(() => {
		setSelectedEvent((current) => (current ? null : current));
		if (typeof window !== "undefined") {
			const currentState =
				window.history.state &&
				typeof window.history.state === "object" &&
				!Array.isArray(window.history.state)
					? (window.history.state as Record<string, unknown>)
					: {};
			const hasEventParam = new URLSearchParams(window.location.search).has(
				"event",
			);
			if (hasEventParam && currentState[EVENT_MODAL_HISTORY_FLAG] === true) {
				window.history.back();
				return;
			}
		}
		updateUrlWithoutNavigation(createUrlForEventState(null), "replace");
	}, [createUrlForEventState, updateUrlWithoutNavigation]);

	const scrollToAllEvents = useCallback(() => {
		allEventsRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}, []);

	const spotlightEvents = useMemo(() => {
		const alwaysFeatured = initialEvents.filter((event) =>
			shouldDisplayFeaturedEvent(event),
		);
		const featuredKeys = new Set(alwaysFeatured.map((event) => event.eventKey));
		const filteredRemainder = filteredEvents.filter(
			(event) => !featuredKeys.has(event.eventKey),
		);
		return [...alwaysFeatured, ...filteredRemainder];
	}, [filteredEvents, initialEvents]);

	const allEventsOrdered = useMemo(() => {
		const featuredMatches = filteredEvents.filter((event) =>
			shouldDisplayFeaturedEvent(event),
		);
		const featuredEventKeys = new Set(
			featuredMatches.map((event) => event.eventKey),
		);
		const regularMatches = filteredEvents.filter(
			(event) => !featuredEventKeys.has(event.eventKey),
		);
		return [...featuredMatches, ...regularMatches];
	}, [filteredEvents]);

	return (
		<>
			<div className="mb-8">
				<AuthGate
					isAuthenticated={isAuthenticated}
					isAuthResolved={isAuthResolved}
					onAuthRequired={() => setShowEmailGate(true)}
					className="min-h-[120px] flex items-center"
				>
					<SearchBar
						onSearch={onSearchQueryChange}
						placeholder="Search events, locations, genres, types..."
						className="max-w-md mx-auto"
					/>
				</AuthGate>
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
				events={spotlightEvents}
				onEventClick={handleEventClick}
				onScrollToAllEvents={scrollToAllEvents}
			/>

			<EventStats events={initialEvents} filteredEvents={filteredEvents} />

			<div className="mb-8 relative z-10">
				<EventsMapCard
					events={filteredEvents}
					isExpanded={isMapExpanded}
					onToggleExpanded={toggleMapExpansion}
					onEventClick={handleEventClick}
					mapLoadStrategy={mapLoadStrategy}
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
						availableEventDates={availableEventDates}
						quickSelectEventDates={quickSelectEventDates}
						filteredEventsCount={filteredEvents.length}
						isOpen={isFilterOpen}
						onClose={() => setIsFilterOpen(false)}
						onOpen={() => setIsFilterOpen(true)}
						isExpanded={isFilterExpanded}
						onToggleExpanded={toggleFilterExpansion}
					/>
				</AuthGate>
			</div>

			<AllEvents
				ref={allEventsRef}
				events={allEventsOrdered}
				onEventClick={handleEventClick}
				onFilterClickAction={toggleFilterPanel}
				onAuthRequired={() => setShowEmailGate(true)}
				hasActiveFilters={hasAnyActiveFilters}
				activeFiltersCount={activeFiltersCount}
				isAuthenticated={isAuthenticated}
				isAuthResolved={isAuthResolved}
			/>

			<EventModal
				event={selectedEvent}
				isOpen={selectedEvent !== null}
				onClose={handleEventClose}
			/>

			<EmailGateModal
				isOpen={showEmailGate}
				onClose={() => setShowEmailGate(false)}
				onEmailSubmit={handleEmailSubmit}
			/>

			<ScrollToTopButton />
		</>
	);
}
