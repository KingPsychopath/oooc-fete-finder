"use client";

import maplibregl from "maplibre-gl";
import React, { useState, useEffect, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import arrondissementData from "@/data/paris-arr-v2.json";
import { trackDiscoveryAnalytics } from "@/features/events/engagement/client-tracking";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import type { Event } from "@/features/events/types";
import {
	type Coordinates,
	type DayNightPeriod,
	formatDayWithDate,
	formatPrice,
	getEventDisplayDayNightPeriod,
} from "@/features/events/types";
import type { SavedClientLocation } from "@/features/locations/client-location";
import { calculateDistanceKm } from "@/features/locations/nearby-event-service";
import {
	DEFAULT_NEARBY_RADIUS_KM,
	NEARBY_RADIUS_OPTIONS_KM,
	type NearbyLocationScope,
	type NearbyRadiusKm,
	PARIS_MAP_BOUNDS,
	getNearbyLocationScope,
} from "@/features/locations/nearby-location";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { clientLog } from "@/lib/platform/client-logger";
import { cn } from "@/lib/utils";
import {
	Building2,
	CalendarDays,
	ChevronDown,
	Euro,
	Filter,
	Locate,
	MapPin,
	MapPinned,
	Maximize2,
	Minimize2,
	Minus,
	Moon,
	Plus,
	Star,
	Sun,
	Trees,
	X,
} from "lucide-react";

// Paris Arrondissements GeoJSON Types - Updated for v2 JSON structure
/**
 * Enhanced properties object for each Paris arrondissement feature
 * Contains comprehensive metadata including surface area, perimeter, and official names
 * Compatible with paris-arr-v2.json which includes all 20 arrondissements
 */
interface ParisArrondissementProperties {
	/** Sequential square number for the arrondissement */
	n_sq_ar: number;
	/** Arrondissement number used for styling and identification (1-20) */
	c_ar: number;
	/** INSEE code for the arrondissement (e.g., 75101, 75112, 75120) */
	c_arinsee: number;
	/** Short arrondissement label (e.g., "1er Ardt", "12ème Ardt") */
	l_ar: string;
	/** Official arrondissement name (e.g., "Louvre", "Élysée", "Reuilly") */
	l_aroff: string;
	/** Sequential square number for commune */
	n_sq_co: number;
	/** Surface area of the arrondissement in square meters */
	surface: number;
	/** Perimeter of the arrondissement in meters */
	perimetre: number;
	/** Center point coordinates for the arrondissement */
	geom_x_y: {
		lon: number;
		lat: number;
	};
}

/**
 * Complete GeoJSON feature structure for Paris arrondissements
 * Enhanced version compatible with the comprehensive v2 dataset
 */
interface ParisArrondissementFeature {
	type: "Feature";
	/**
	 * POLYGON GEOMETRY FOR BOUNDARY RENDERING
	 * Contains the actual polygon coordinates used by MapLibre to draw arrondissement boundaries
	 */
	geometry: {
		type: "Polygon";
		/**
		 * Array of coordinate rings: [[[lng, lat], [lng, lat], ...]]
		 * MapLibre uses these coordinates to draw the arrondissement boundaries
		 */
		coordinates: number[][][];
	} | null;
	/** Enhanced properties with comprehensive arrondissement metadata */
	properties: ParisArrondissementProperties;
}

interface ParisArrondissementFeatureWithGeometry
	extends ParisArrondissementFeature {
	geometry: {
		type: "Polygon";
		coordinates: number[][][];
	};
}

interface ParisMapLibreProps {
	events: Event[];
	onEventClick: (event: Event) => void;
	selectedDay?: string;
	className?: string;
	resizeSignal?: number;
	onFullscreenRequest?: () => void;
	isFullscreen?: boolean;
	onFilterClick?: () => void;
	hasActiveFilters?: boolean;
	activeFiltersCount?: number;
	canUseParisTestLocation?: boolean;
	isOfflineMode?: boolean;
	selectedDayNightPeriods?: DayNightPeriod[];
	isNearbyActive?: boolean;
	nearbyEventsError?: string | null;
	nearbyEventsStatus?: string;
	nearbyLocation?: SavedClientLocation | null;
	nearbyLocationScope?: NearbyLocationScope | null;
	nearbyMatchedEventsCount?: number;
	nearbyRadiusKm?: NearbyRadiusKm;
	nearbyRadiusOptionsKm?: readonly NearbyRadiusKm[];
	onNearbyClick?: () => void;
	onNearbyRadiusChange?: (radiusKm: NearbyRadiusKm) => void;
	onNearbyResultsClick?: () => void;
	onParisTestLocationClick?: () => void;
}

// Paris center coordinates
const PARIS_CENTER: [number, number] = [2.3522, 48.8566]; // [lng, lat]
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MAP_TEXT_FONT = ["Noto Sans Regular"];
const MAP_LOAD_ERROR_GRACE_MS = 10000;
const MAP_INIT_RETRY_DELAY_MS = 900;
const MAX_MAP_INIT_ATTEMPTS = 2;
const MAP_TILE_LOADING_NOTICE_DELAY_MS = 1200;
const MAP_PREVIEW_IMAGE_URL = "/maps/paris-map-preview.jpg";
const MAP_ONLINE_ONLY_MESSAGE =
	"Map style, sprite, glyph, and tile assets are online-only";
const MAP_MIN_ZOOM = 9.25;
const NEARBY_RADIUS_POLYGON_STEPS = 96;
const KM_PER_LATITUDE_DEGREE = 110.574;
const KM_PER_LONGITUDE_DEGREE_AT_EQUATOR = 111.32;

/**
 * Arrondissement fill colors based on event density
 * Colors are applied conditionally based on the number of events in each arrondissement
 */
const ARRONDISSEMENT_COLORS = {
	/** No events - Light gray */
	EMPTY: "#e5e7eb",
	/** 1 event - Green */
	LOW: "#16a34a",
	/** 2-4 events - Orange */
	MEDIUM: "#ea580c",
	/** 5+ events - Red */
	HIGH: "#dc2626",
	/** Selected arrondissement - Blue */
	SELECTED: "#1d4ed8",
	/** Hovered arrondissement - Dark gray */
	HOVER: "#374151",
} as const;

const DISTRICT_ACTIVITY_LEVELS = [
	{
		label: "Quiet",
		rangeLabel: "0",
		activityLabel: "No current events",
		minEventCount: 0,
		maxEventCount: 0,
		color: ARRONDISSEMENT_COLORS.EMPTY,
	},
	{
		label: "Light",
		rangeLabel: "1-3",
		activityLabel: "Low activity district",
		minEventCount: 1,
		maxEventCount: 3,
		color: ARRONDISSEMENT_COLORS.LOW,
	},
	{
		label: "Warm",
		rangeLabel: "4-7",
		activityLabel: "Busy district",
		minEventCount: 4,
		maxEventCount: 7,
		color: ARRONDISSEMENT_COLORS.MEDIUM,
	},
	{
		label: "Hotspot",
		rangeLabel: "8+",
		activityLabel: "Hotspot district",
		minEventCount: 8,
		maxEventCount: Number.POSITIVE_INFINITY,
		color: ARRONDISSEMENT_COLORS.HIGH,
	},
] as const;

const getDistrictActivityLevel = (eventCount: number) =>
	DISTRICT_ACTIVITY_LEVELS.find(
		({ minEventCount, maxEventCount }) =>
			eventCount >= minEventCount && eventCount <= maxEventCount,
	) ?? DISTRICT_ACTIVITY_LEVELS[0];

/**
 * Gets the appropriate fill color for an arrondissement based on event count
 * @param eventCount - Number of events in the arrondissement
 * @returns Hex color string for the arrondissement fill
 */
const getArrondissementFillColor = (eventCount: number): string =>
	getDistrictActivityLevel(eventCount).color;

const isParisArrondissementFeatureWithGeometry = (
	feature: ParisArrondissementFeature,
): feature is ParisArrondissementFeatureWithGeometry =>
	Boolean(feature.geometry);

const PARIS_ARRONDISSEMENT_DATA = {
	...(arrondissementData as GeoJSON.FeatureCollection & {
		features: ParisArrondissementFeature[];
	}),
	features: (
		arrondissementData as GeoJSON.FeatureCollection & {
			features: ParisArrondissementFeature[];
		}
	).features.filter(isParisArrondissementFeatureWithGeometry),
};

const getDistrictActivityLabel = (eventCount: number): string =>
	getDistrictActivityLevel(eventCount).activityLabel;

const buildNearbyRadiusPolygon = (
	center: Coordinates,
	radiusKm: number,
): GeoJSON.Feature<GeoJSON.Polygon> => {
	const coordinates: [number, number][] = [];
	const centerLatRadians = (center.lat * Math.PI) / 180;
	const lngDegreeKm = Math.max(
		KM_PER_LONGITUDE_DEGREE_AT_EQUATOR * Math.cos(centerLatRadians),
		0.0001,
	);

	for (let index = 0; index <= NEARBY_RADIUS_POLYGON_STEPS; index += 1) {
		const angle = (index / NEARBY_RADIUS_POLYGON_STEPS) * Math.PI * 2;
		const lat =
			center.lat + (Math.sin(angle) * radiusKm) / KM_PER_LATITUDE_DEGREE;
		const lng = center.lng + (Math.cos(angle) * radiusKm) / lngDegreeKm;
		coordinates.push([lng, lat]);
	}

	return {
		type: "Feature",
		geometry: {
			type: "Polygon",
			coordinates: [coordinates],
		},
		properties: {},
	};
};

const getNearbyRadiusBounds = (
	center: Coordinates,
	radiusKm: number,
): [[number, number], [number, number]] => {
	const centerLatRadians = (center.lat * Math.PI) / 180;
	const lngDegreeKm = Math.max(
		KM_PER_LONGITUDE_DEGREE_AT_EQUATOR * Math.cos(centerLatRadians),
		0.0001,
	);
	const latDelta = radiusKm / KM_PER_LATITUDE_DEGREE;
	const lngDelta = radiusKm / lngDegreeKm;
	return [
		[center.lng - lngDelta, center.lat - latDelta],
		[center.lng + lngDelta, center.lat + latDelta],
	];
};

const formatEventMapSchedule = (event: Event): string => {
	const dateLabel = formatDayWithDate(event.day, event.date);
	const hasStartTime = Boolean(event.time && event.time !== "TBC");
	const hasEndTime = Boolean(event.endTime && event.endTime !== "TBC");

	if (!hasStartTime) return `${dateLabel} • Time TBC`;
	if (hasEndTime) return `${dateLabel} • ${event.time} - ${event.endTime}`;
	return `${dateLabel} • ${event.time}`;
};

type CoordinateEventStack = {
	key: string;
	coordinates: Coordinates;
	events: Event[];
};

const getCoordinateStackKey = (coordinates: Coordinates): string =>
	`${coordinates.lat.toFixed(6)}:${coordinates.lng.toFixed(6)}`;

const ParisMapLibre: React.FC<ParisMapLibreProps> = ({
	events,
	onEventClick,
	selectedDay,
	className,
	resizeSignal = 0,
	onFullscreenRequest,
	isFullscreen = false,
	onFilterClick,
	hasActiveFilters = false,
	activeFiltersCount = 0,
	canUseParisTestLocation = false,
	isOfflineMode = false,
	selectedDayNightPeriods = [],
	isNearbyActive = false,
	nearbyEventsError = null,
	nearbyEventsStatus = "idle",
	nearbyLocation = null,
	nearbyLocationScope = null,
	nearbyMatchedEventsCount = 0,
	nearbyRadiusKm = DEFAULT_NEARBY_RADIUS_KM,
	nearbyRadiusOptionsKm = NEARBY_RADIUS_OPTIONS_KM,
	onNearbyClick,
	onNearbyRadiusChange,
	onNearbyResultsClick,
	onParisTestLocationClick,
}) => {
	const haptics = useAppHaptics();
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<maplibregl.Map | null>(null);
	const hasLoadedMapRef = useRef(false);
	const loadErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const initRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const locateNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const mapInitAttemptRef = useRef(0);
	const nonFatalMapErrorCountRef = useRef(0);
	const [mapLoaded, setMapLoaded] = useState(false);
	const [mapTilesSettled, setMapTilesSettled] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedArrondissement, setSelectedArrondissement] = useState<
		number | null
	>(null);
	const [isLegendExpanded, setIsLegendExpanded] = useState(!isFullscreen);
	const [showCoordinates, setShowCoordinates] = useState(true);
	const [showLocateNotice, setShowLocateNotice] = useState(false);
	const [showTileLoadingNotice, setShowTileLoadingNotice] = useState(false);
	const [selectedCoordinateStackKey, setSelectedCoordinateStackKey] = useState<
		string | null
	>(null);
	const nearbyViewKeyRef = useRef<string | null>(null);

	// Filter events based on selected day
	const filteredEvents = React.useMemo(() => {
		return events.filter((event) => {
			const dayMatches = !selectedDay || event.day === selectedDay;
			return dayMatches;
		});
	}, [events, selectedDay]);

	const eventsById = React.useMemo(() => {
		return new Map(filteredEvents.map((event) => [event.id, event]));
	}, [filteredEvents]);

	const eventsWithCoordinatesCount = React.useMemo(
		() =>
			filteredEvents.filter(
				(event) =>
					event.coordinates &&
					typeof event.coordinates.lat === "number" &&
					typeof event.coordinates.lng === "number" &&
					!isNaN(event.coordinates.lat) &&
					!isNaN(event.coordinates.lng),
			).length,
		[filteredEvents],
	);

	const coordinateEventStacks = React.useMemo<CoordinateEventStack[]>(() => {
		const stacksByCoordinate = new Map<string, CoordinateEventStack>();

		for (const event of filteredEvents) {
			const coordinates = event.coordinates;
			if (
				!coordinates ||
				typeof coordinates.lat !== "number" ||
				typeof coordinates.lng !== "number" ||
				isNaN(coordinates.lat) ||
				isNaN(coordinates.lng)
			) {
				continue;
			}

			const key = getCoordinateStackKey(coordinates);
			const existingStack = stacksByCoordinate.get(key);
			if (existingStack) {
				existingStack.events.push(event);
				continue;
			}

			stacksByCoordinate.set(key, {
				key,
				coordinates,
				events: [event],
			});
		}

		return Array.from(stacksByCoordinate.values()).map((stack) => ({
			...stack,
			events: stack.events.slice().sort((left, right) => {
				const leftRank = shouldDisplayFeaturedEvent(left)
					? 4
					: left.isPromoted === true
						? 3
						: left.isOOOCPick
							? 2
							: 1;
				const rightRank = shouldDisplayFeaturedEvent(right)
					? 4
					: right.isPromoted === true
						? 3
						: right.isOOOCPick
							? 2
							: 1;
				if (leftRank !== rightRank) return rightRank - leftRank;
				return left.name.localeCompare(right.name);
			}),
		}));
	}, [filteredEvents]);

	const coordinateEventStacksByKey = React.useMemo(
		() => new Map(coordinateEventStacks.map((stack) => [stack.key, stack])),
		[coordinateEventStacks],
	);

	const selectedCoordinateStack = selectedCoordinateStackKey
		? (coordinateEventStacksByKey.get(selectedCoordinateStackKey) ?? null)
		: null;

	const canShowCoordinates = eventsWithCoordinatesCount > 0;
	const areEventPinsVisible = showCoordinates && canShowCoordinates;
	const effectiveNearbyLocationScope = nearbyLocation
		? (nearbyLocationScope ??
			getNearbyLocationScope(nearbyLocation.coordinates))
		: null;
	const isNearbyInsideParisMap =
		isNearbyActive &&
		nearbyLocation !== null &&
		effectiveNearbyLocationScope === "paris-map";
	const isNearbyOutsideParisMap =
		isNearbyActive &&
		nearbyLocation !== null &&
		effectiveNearbyLocationScope === "outside-paris-map";
	const shouldShowNearbyStatus =
		mapLoaded &&
		(isNearbyActive ||
			nearbyEventsStatus === "requesting" ||
			Boolean(nearbyEventsError));
	const outsideParisMapCopy = isFullscreen
		? "You're outside the Paris map area, so the map stays on Paris."
		: "You're outside the Paris map area, so the map stays on Paris. Nearest events are in the list.";

	useEffect(() => {
		setIsLegendExpanded(!isFullscreen);
	}, [isFullscreen]);

	useEffect(() => {
		if (isFullscreen && selectedArrondissement) {
			setIsLegendExpanded(false);
		}
	}, [isFullscreen, selectedArrondissement]);

	useEffect(() => {
		if (
			selectedCoordinateStackKey &&
			!coordinateEventStacksByKey.has(selectedCoordinateStackKey)
		) {
			setSelectedCoordinateStackKey(null);
		}
	}, [coordinateEventStacksByKey, selectedCoordinateStackKey]);

	const arrondissementEventCounts = React.useMemo(() => {
		const counts: Record<number, number> = {};
		for (let i = 1; i <= 20; i++) {
			counts[i] = 0;
		}
		for (const event of filteredEvents) {
			if (
				typeof event.arrondissement === "number" &&
				event.arrondissement >= 1 &&
				event.arrondissement <= 20
			) {
				counts[event.arrondissement] += 1;
			}
		}
		return counts;
	}, [filteredEvents]);

	const selectedArrondissementRef = useRef<number | null>(null);
	const arrondissementEventCountsRef = useRef<Record<number, number>>({});

	// Get events in specific arrondissement
	const getEventsInArrondissement = useCallback(
		(arrondissement: number) => {
			const arrondissementEvents = filteredEvents.filter(
				(event) => event.arrondissement === arrondissement,
			);
			const featuredEvents = arrondissementEvents.filter((event) =>
				shouldDisplayFeaturedEvent(event),
			);
			const featuredEventIds = new Set(featuredEvents.map((event) => event.id));
			const promotedEvents = arrondissementEvents.filter(
				(event) => !featuredEventIds.has(event.id) && event.isPromoted === true,
			);
			if (featuredEvents.length === 0 && promotedEvents.length === 0) {
				return arrondissementEvents;
			}
			const promotedEventIds = new Set(promotedEvents.map((event) => event.id));
			const regularEvents = arrondissementEvents
				.filter((event) => !featuredEventIds.has(event.id))
				.filter((event) => !promotedEventIds.has(event.id));
			return [...featuredEvents, ...promotedEvents, ...regularEvents];
		},
		[filteredEvents],
	);

	const getEventVenueTypes = useCallback(
		(event: Event): ("indoor" | "outdoor")[] => {
			if (event.venueTypes && event.venueTypes.length > 0) {
				return [...new Set(event.venueTypes)];
			}
			return [event.indoor ? "indoor" : "outdoor"];
		},
		[],
	);

	const selectedArrondissementEvents = React.useMemo(() => {
		if (!selectedArrondissement) return [];
		return getEventsInArrondissement(selectedArrondissement);
	}, [getEventsInArrondissement, selectedArrondissement]);

	const selectedArrondissementSummary = React.useMemo(() => {
		const featuredCount = selectedArrondissementEvents.filter((event) =>
			shouldDisplayFeaturedEvent(event),
		).length;
		const promotedCount = selectedArrondissementEvents.filter(
			(event) =>
				!shouldDisplayFeaturedEvent(event) && event.isPromoted === true,
		).length;
		const ooocCount = selectedArrondissementEvents.filter(
			(event) => event.isOOOCPick,
		).length;
		return {
			total: selectedArrondissementEvents.length,
			activityLabel: getDistrictActivityLabel(
				selectedArrondissementEvents.length,
			),
			featuredCount,
			promotedCount,
			ooocCount,
		};
	}, [selectedArrondissementEvents]);
	const baseEventButtonClassName =
		"w-full rounded-xl border p-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
	const regularEventButtonClassName =
		"border-border/70 bg-background/65 hover:bg-accent/65";
	const featuredEventButtonClassName =
		"border-rose-300/80 bg-[linear-gradient(145deg,rgba(255,236,239,0.94),rgba(255,221,229,0.8))] shadow-[0_14px_30px_-26px_rgba(190,18,60,0.42)] hover:bg-[linear-gradient(145deg,rgba(255,240,243,0.98),rgba(255,225,232,0.88))] dark:border-rose-400/55 dark:bg-[linear-gradient(145deg,rgba(86,31,45,0.5),rgba(68,24,35,0.36))]";
	const promotedEventButtonClassName =
		"border-rose-300/45 bg-[linear-gradient(145deg,rgba(255,244,240,0.86),rgba(250,235,226,0.72))] hover:bg-[linear-gradient(145deg,rgba(255,247,243,0.94),rgba(252,239,232,0.82))] dark:border-rose-300/30 dark:bg-[linear-gradient(145deg,rgba(74,43,39,0.4),rgba(56,35,32,0.28))]";
	const ooocEventButtonClassName =
		"border-amber-300/75 bg-[linear-gradient(145deg,rgba(248,238,222,0.86),rgba(244,229,205,0.72))] dark:border-amber-500/40 dark:bg-[linear-gradient(145deg,rgba(65,49,30,0.45),rgba(47,36,24,0.32))]";
	const featuredOoocEventButtonClassName =
		"border-[color:color-mix(in_oklab,#e11d48_54%,#d8a241_46%)] bg-[linear-gradient(145deg,rgba(255,241,228,0.96),rgba(255,226,219,0.84))] shadow-[0_14px_30px_-26px_rgba(190,18,60,0.38)] dark:border-[color:color-mix(in_oklab,#fb7185_56%,#d8a241_44%)] dark:bg-[linear-gradient(145deg,rgba(88,53,33,0.52),rgba(87,33,45,0.38))]";

	// Update arrondissement colors based on event density
	const updateArrondissementColors = useCallback(() => {
		if (!map.current) return;
		try {
			if (!map.current.getLayer("admin-fill")) return;
		} catch {
			return;
		}
		const selectedArr = selectedArrondissementRef.current;
		const eventCounts = arrondissementEventCountsRef.current;

		// Create color expression for MapLibre
		const colorExpression: (
			| string
			| number
			| (string | number | (string | number)[])[]
			| boolean
		)[] = ["case"];

		// Add selected arrondissement (always blue)
		if (selectedArr) {
			colorExpression.push(["==", ["get", "c_ar"], selectedArr], "#1d4ed8");
		}

		// Add colors for each arrondissement based on event count
		for (let i = 1; i <= 20; i++) {
			const count = eventCounts[i];
			const color = getArrondissementFillColor(count);
			colorExpression.push(["==", ["get", "c_ar"], i], color);
		}

		// Default fallback color
		colorExpression.push("#e5e7eb");

		// Update the layer paint property
		try {
			map.current.setPaintProperty("admin-fill", "fill-color", colorExpression);
		} catch {
			// Map/style may have been torn down between checks.
		}
	}, []);

	const handleAdminFillClick = useCallback(
		(
			e: maplibregl.MapMouseEvent & {
				features?: maplibregl.MapGeoJSONFeature[];
			},
		) => {
			if (!e.features?.[0]) return;
			const properties = e.features[0]
				.properties as ParisArrondissementProperties;
			const arrondissement = properties.c_ar;
			if (!arrondissement) return;
			const eventCount =
				arrondissementEventCountsRef.current[arrondissement] ?? 0;
			if (selectedArrondissementRef.current === arrondissement) {
				haptics.light();
			} else {
				haptics.selection();
			}
			setSelectedCoordinateStackKey(null);
			setSelectedArrondissement((current) =>
				current === arrondissement ? null : arrondissement,
			);
			trackDiscoveryAnalytics({
				actionType: "map_interaction",
				filterGroup: "map_arrondissement",
				filterValue: `${arrondissement}:${eventCount}`,
			});
		},
		[haptics],
	);

	const handleAdminFillMouseEnter = useCallback(() => {
		if (map.current) {
			map.current.getCanvas().style.cursor = "pointer";
		}
	}, []);

	const handleAdminFillMouseLeave = useCallback(() => {
		if (map.current) {
			map.current.getCanvas().style.cursor = "";
		}
	}, []);

	const handleEventMarkersClick = useCallback(
		(
			e: maplibregl.MapMouseEvent & {
				features?: maplibregl.MapGeoJSONFeature[];
			},
		) => {
			const renderedFeatures =
				map.current?.queryRenderedFeatures(e.point, {
					layers: ["event-markers", "event-star-markers", "event-stack-counts"],
				}) ??
				e.features ??
				[];
			const stackKey = renderedFeatures
				.map((feature) => feature.properties?.stackKey)
				.find(
					(candidate): candidate is string => typeof candidate === "string",
				);
			if (stackKey) {
				const stack = coordinateEventStacksByKey.get(stackKey);
				if (stack && stack.events.length > 1) {
					haptics.selection();
					setSelectedArrondissement(null);
					setSelectedCoordinateStackKey(stack.key);
					return;
				}
				const singleEvent = stack?.events[0];
				if (singleEvent) {
					if (
						shouldDisplayFeaturedEvent(singleEvent) ||
						singleEvent.isOOOCPick
					) {
						haptics.success();
					} else {
						haptics.selection();
					}
					onEventClick(singleEvent);
					return;
				}
			}

			const clickedEvents = renderedFeatures
				.flatMap((feature) => {
					const eventIdsValue = feature.properties?.eventIds;
					if (typeof eventIdsValue === "string") {
						return eventIdsValue.split("|");
					}
					const eventId = feature.properties?.id;
					return typeof eventId === "string" ? [eventId] : [];
				})
				.map((eventId) => eventsById.get(eventId))
				.filter((event): event is Event => Boolean(event));
			const preferredEvent =
				clickedEvents.find((event) => shouldDisplayFeaturedEvent(event)) ??
				clickedEvents.find((event) => event.isPromoted === true) ??
				clickedEvents.find((event) => event.isOOOCPick === true) ??
				clickedEvents[0];
			if (preferredEvent) {
				if (
					shouldDisplayFeaturedEvent(preferredEvent) ||
					preferredEvent.isOOOCPick
				) {
					haptics.success();
				} else {
					haptics.selection();
				}
				onEventClick(preferredEvent);
				return;
			}

			const eventId = e.features?.[0]?.properties?.id;
			if (typeof eventId !== "string") return;
			const event = eventsById.get(eventId);
			if (event) {
				haptics.selection();
				onEventClick(event);
			}
		},
		[coordinateEventStacksByKey, eventsById, haptics, onEventClick],
	);

	const handleEventClusterClick = useCallback(
		(
			e: maplibregl.MapMouseEvent & {
				features?: maplibregl.MapGeoJSONFeature[];
			},
		) => {
			const feature = e.features?.[0];
			const clusterId = feature?.properties?.cluster_id;
			if (typeof clusterId !== "number" || !map.current) return;
			haptics.nudge();
			const pointCount =
				typeof feature?.properties?.point_count === "number"
					? feature.properties.point_count
					: null;
			trackDiscoveryAnalytics({
				actionType: "map_interaction",
				filterGroup: "map_cluster",
				filterValue: pointCount == null ? "unknown" : String(pointCount),
			});

			const source = map.current.getSource("events");
			if (!source || !("getClusterExpansionZoom" in source)) return;

			const geoJsonSource = source as maplibregl.GeoJSONSource;
			geoJsonSource.getClusterExpansionZoom(clusterId).then((zoom) => {
				if (!map.current) return;
				if (typeof zoom !== "number" || Number.isNaN(zoom)) return;
				map.current.easeTo({
					center: e.lngLat,
					zoom,
					duration: 650,
				});
			});
		},
		[haptics],
	);

	const handleEventMarkersMouseEnter = useCallback(() => {
		if (map.current) {
			map.current.getCanvas().style.cursor = "pointer";
		}
	}, []);

	const handleEventMarkersMouseLeave = useCallback(() => {
		if (map.current) {
			map.current.getCanvas().style.cursor = "";
		}
	}, []);

	const handleZoomIn = useCallback(() => {
		haptics.selection();
		map.current?.zoomTo(map.current.getZoom() + 1, { duration: 300 });
	}, [haptics]);

	const handleZoomOut = useCallback(() => {
		haptics.selection();
		map.current?.zoomTo(map.current.getZoom() - 1, { duration: 300 });
	}, [haptics]);

	const handleLocateClick = useCallback(() => {
		haptics.nudge();
		trackDiscoveryAnalytics({
			actionType: "location_request",
			filterGroup: "nearby",
			filterValue: isNearbyActive ? "map_nearby_disable" : "map_nearby_request",
		});
		if (onNearbyClick) {
			onNearbyClick();
			return;
		}
		setShowLocateNotice(true);
		if (locateNoticeTimeoutRef.current) {
			clearTimeout(locateNoticeTimeoutRef.current);
		}
		locateNoticeTimeoutRef.current = setTimeout(() => {
			setShowLocateNotice(false);
		}, 3600);
	}, [haptics, isNearbyActive, onNearbyClick]);

	const handleFullscreenClick = useCallback(() => {
		haptics.nudge();
		trackDiscoveryAnalytics({
			actionType: "map_interaction",
			filterGroup: "map_control",
			filterValue: isFullscreen ? "fullscreen_close" : "fullscreen_open",
		});
		onFullscreenRequest?.();
	}, [haptics, isFullscreen, onFullscreenRequest]);

	const handleMapRetry = useCallback(() => {
		haptics.selection();
		if (loadErrorTimeoutRef.current) {
			clearTimeout(loadErrorTimeoutRef.current);
			loadErrorTimeoutRef.current = null;
		}
		if (initRetryTimeoutRef.current) {
			clearTimeout(initRetryTimeoutRef.current);
			initRetryTimeoutRef.current = null;
		}

		const currentMap = map.current;
		if (currentMap) {
			try {
				currentMap.remove();
			} catch (error) {
				clientLog.warn("maps.maplibre", "Map retry cleanup error", {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		map.current = null;
		hasLoadedMapRef.current = false;
		mapInitAttemptRef.current = 0;
		nonFatalMapErrorCountRef.current = 0;
		setMapLoaded(false);
		setMapTilesSettled(false);
		setShowTileLoadingNotice(false);
		setIsLoading(true);
		setLoadError(null);
	}, [haptics]);

	const handleFullscreenPointerDown = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();
			handleFullscreenClick();
		},
		[handleFullscreenClick],
	);

	useEffect(() => {
		return () => {
			if (locateNoticeTimeoutRef.current) {
				clearTimeout(locateNoticeTimeoutRef.current);
			}
			if (initRetryTimeoutRef.current) {
				clearTimeout(initRetryTimeoutRef.current);
			}
		};
	}, []);

	// Initialize map with proper cleanup
	useEffect(() => {
		let isCancelled = false;
		let frameId: number | null = null;
		let resizeObserver: ResizeObserver | null = null;

		const clearLoadErrorTimer = () => {
			if (loadErrorTimeoutRef.current) {
				clearTimeout(loadErrorTimeoutRef.current);
				loadErrorTimeoutRef.current = null;
			}
		};

		const clearInitRetryTimer = () => {
			if (initRetryTimeoutRef.current) {
				clearTimeout(initRetryTimeoutRef.current);
				initRetryTimeoutRef.current = null;
			}
		};

		const removeCurrentMap = (logLabel: string) => {
			const currentMap = map.current;
			if (!currentMap) return;
			try {
				currentMap.remove();
			} catch (error) {
				clientLog.warn("maps.maplibre", logLabel, {
					error: error instanceof Error ? error.message : String(error),
				});
			} finally {
				map.current = null;
			}
		};

		if (isOfflineMode) {
			removeCurrentMap("Map offline cleanup error");
			hasLoadedMapRef.current = false;
			clearLoadErrorTimer();
			clearInitRetryTimer();
			setMapLoaded(false);
			setMapTilesSettled(false);
			setShowTileLoadingNotice(false);
			setIsLoading(false);
			setLoadError(null);
			return;
		}
		if (loadError) return;
		if (!mapContainer.current || map.current) return;
		hasLoadedMapRef.current = false;
		mapInitAttemptRef.current = 0;
		nonFatalMapErrorCountRef.current = 0;
		setMapTilesSettled(false);
		setShowTileLoadingNotice(false);

		const initMap = (container: HTMLDivElement) => {
			if (isCancelled || map.current) return;
			mapInitAttemptRef.current += 1;

			try {
				setIsLoading(true);
				setLoadError(null);

				map.current = new maplibregl.Map({
					container,
					style: MAP_STYLE_URL,
					center: PARIS_CENTER,
					zoom: 11,
					minZoom: MAP_MIN_ZOOM,
					maxZoom: 18,
					dragPan: true,
					scrollZoom: true,
					doubleClickZoom: true,
					keyboard: true,
					dragRotate: false,
					touchPitch: false,
					touchZoomRotate: true,
					attributionControl: {
						compact: true,
						customAttribution: "OpenFreeMap (c)",
					},
					maxBounds: [
						[PARIS_MAP_BOUNDS.southWest.lng, PARIS_MAP_BOUNDS.southWest.lat],
						[PARIS_MAP_BOUNDS.northEast.lng, PARIS_MAP_BOUNDS.northEast.lat],
					],
				});
				const currentMap = map.current;
				if (!currentMap) return;

				const hasMapStyle = (): boolean => {
					try {
						return (currentMap.getStyle() as unknown) !== undefined;
					} catch {
						return false;
					}
				};

				const isMapUsable = (): boolean => {
					try {
						if (!hasMapStyle()) return false;
						return currentMap.isStyleLoaded() === true;
					} catch {
						return false;
					}
				};

				const isMapFullySettled = (): boolean => {
					try {
						if (!hasMapStyle()) return false;
						return (
							currentMap.isStyleLoaded() === true &&
							currentMap.areTilesLoaded() === true
						);
					} catch {
						return false;
					}
				};

				const markMapReady = () => {
					if (isCancelled) return;
					if (hasLoadedMapRef.current) return;
					hasLoadedMapRef.current = true;
					clearLoadErrorTimer();
					clearInitRetryTimer();
					setMapLoaded(true);
					setMapTilesSettled(isMapFullySettled());
					setIsLoading(false);
					const collapseAttribution = () => {
						const attribution = mapContainer.current?.querySelector(
							".maplibregl-ctrl-attrib.maplibregl-compact",
						);
						const attributionInner = attribution?.querySelector(
							".maplibregl-ctrl-attrib-inner",
						);
						if (attributionInner) {
							attributionInner.textContent = "OpenFreeMap (c)";
						}
						attribution?.classList.remove("maplibregl-compact-show");
						attribution?.classList.add("ooo-attribution-ready");
					};
					window.requestAnimationFrame(collapseAttribution);
					window.setTimeout(collapseAttribution, 200);
				};

				const markMapReadyWhenStyleIsReady = () => {
					if (isMapUsable()) {
						markMapReady();
					}
				};

				const markTilesSettledWhenReady = () => {
					if (!hasLoadedMapRef.current) return;
					if (isMapFullySettled()) {
						setMapTilesSettled(true);
						setShowTileLoadingNotice(false);
					}
				};

				const scheduleMapRetry = (message: string) => {
					if (isCancelled || hasLoadedMapRef.current) return;
					if (mapInitAttemptRef.current >= MAX_MAP_INIT_ATTEMPTS) {
						clientLog.error("maps.maplibre", "Map loading error", {
							attempt: mapInitAttemptRef.current,
							message,
						});
						setLoadError("Live map tiles failed to load");
						setIsLoading(false);
						return;
					}

					clientLog.warn("maps.maplibre", "Retrying map initialization", {
						attempt: mapInitAttemptRef.current + 1,
						message,
					});
					removeCurrentMap("Map retry cleanup error");
					clearLoadErrorTimer();
					clearInitRetryTimer();
					initRetryTimeoutRef.current = setTimeout(() => {
						initRetryTimeoutRef.current = null;
						initMap(container);
					}, MAP_INIT_RETRY_DELAY_MS);
				};

				currentMap.on("style.load", markMapReadyWhenStyleIsReady);
				currentMap.on("load", markMapReadyWhenStyleIsReady);
				currentMap.on("idle", markTilesSettledWhenReady);
				currentMap.on("sourcedata", markTilesSettledWhenReady);
				window.requestAnimationFrame(() => {
					markMapReadyWhenStyleIsReady();
				});
				window.setTimeout(() => {
					markMapReadyWhenStyleIsReady();
				}, 120);

				loadErrorTimeoutRef.current = setTimeout(() => {
					loadErrorTimeoutRef.current = null;
					if (hasLoadedMapRef.current) return;
					if (isMapUsable()) {
						markMapReady();
						return;
					}
					scheduleMapRetry("Timed out waiting for map style");
				}, MAP_LOAD_ERROR_GRACE_MS);

				currentMap.on("error", (e: maplibregl.ErrorEvent) => {
					if (hasLoadedMapRef.current) {
						if (nonFatalMapErrorCountRef.current < 3) {
							nonFatalMapErrorCountRef.current += 1;
							clientLog.warn("maps.maplibre", "Non-fatal map asset error", {
								message: e.error.message,
							});
						}
						return;
					}

					clientLog.warn(
						"maps.maplibre",
						"Map loading delayed by asset error",
						{
							attempt: mapInitAttemptRef.current,
							message: e.error.message,
						},
					);
					if (loadErrorTimeoutRef.current) return;

					loadErrorTimeoutRef.current = setTimeout(() => {
						loadErrorTimeoutRef.current = null;
						if (hasLoadedMapRef.current) return;
						if (isMapUsable()) {
							markMapReady();
							return;
						}
						scheduleMapRetry(e.error.message);
					}, MAP_LOAD_ERROR_GRACE_MS);
				});
			} catch (error) {
				clientLog.error(
					"maps.maplibre",
					"Failed to initialize map",
					undefined,
					error,
				);
				setLoadError(
					error instanceof Error ? error.message : "Failed to load map",
				);
				setIsLoading(false);
			}
		};

		const initMapWhenContainerIsReady = () => {
			const container = mapContainer.current;
			if (!container || map.current || isCancelled) return;
			const bounds = container.getBoundingClientRect();
			if (!container.isConnected || bounds.width < 1 || bounds.height < 1) {
				frameId = window.requestAnimationFrame(initMapWhenContainerIsReady);
				return;
			}

			resizeObserver?.disconnect();
			resizeObserver = null;
			initMap(container);
		};

		if (typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(initMapWhenContainerIsReady);
			resizeObserver.observe(mapContainer.current);
		}
		initMapWhenContainerIsReady();

		// Proper cleanup function
		return () => {
			isCancelled = true;
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
			resizeObserver?.disconnect();
			clearLoadErrorTimer();
			clearInitRetryTimer();
			removeCurrentMap("Map cleanup error");
		};
	}, [isOfflineMode, loadError]);

	useEffect(() => {
		if (!map.current) return;

		const signal = resizeSignal;
		let frameId: number | null = null;
		const timeoutId = window.setTimeout(
			() => {
				map.current?.resize();
			},
			signal === 0 ? 0 : 320,
		);

		frameId = window.requestAnimationFrame(() => {
			map.current?.resize();
		});

		return () => {
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
			window.clearTimeout(timeoutId);
		};
	}, [resizeSignal]);

	useEffect(() => {
		if (!mapLoaded) return;

		let frameId: number | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const resizeMap = () => {
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			frameId = window.requestAnimationFrame(() => {
				map.current?.resize();
			});
			timeoutId = setTimeout(() => {
				map.current?.resize();
			}, 260);
		};

		window.addEventListener("resize", resizeMap);
		window.addEventListener("orientationchange", resizeMap);
		window.visualViewport?.addEventListener("resize", resizeMap);

		return () => {
			window.removeEventListener("resize", resizeMap);
			window.removeEventListener("orientationchange", resizeMap);
			window.visualViewport?.removeEventListener("resize", resizeMap);
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [mapLoaded]);

	useEffect(() => {
		if (!mapLoaded || mapTilesSettled || isOfflineMode) {
			setShowTileLoadingNotice(false);
			return;
		}

		const timeoutId = window.setTimeout(() => {
			setShowTileLoadingNotice(true);
		}, MAP_TILE_LOADING_NOTICE_DELAY_MS);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [isOfflineMode, mapLoaded, mapTilesSettled]);

	useEffect(() => {
		selectedArrondissementRef.current = selectedArrondissement;
		if (mapLoaded) {
			updateArrondissementColors();
		}
	}, [selectedArrondissement, mapLoaded, updateArrondissementColors]);

	useEffect(() => {
		arrondissementEventCountsRef.current = arrondissementEventCounts;
		if (mapLoaded) {
			updateArrondissementColors();
		}
	}, [arrondissementEventCounts, mapLoaded, updateArrondissementColors]);

	// Load boundaries with lazy loading
	useEffect(() => {
		if (!map.current || !mapLoaded) return;
		const currentMap = map.current;
		let isCancelled = false;

		const loadBoundaries = async () => {
			try {
				if (isCancelled) return;

				// Check if source already exists
				let hasBoundariesSource = false;
				try {
					hasBoundariesSource = Boolean(
						currentMap.getSource("admin-boundaries"),
					);
				} catch {
					return;
				}
				if (!hasBoundariesSource) {
					currentMap.addSource("admin-boundaries", {
						type: "geojson",
						data: PARIS_ARRONDISSEMENT_DATA,
					});
				}

				// Add fill layer
				let hasAdminFillLayer = false;
				try {
					hasAdminFillLayer = Boolean(currentMap.getLayer("admin-fill"));
				} catch {
					return;
				}
				if (!hasAdminFillLayer) {
					currentMap.addLayer({
						id: "admin-fill",
						type: "fill",
						source: "admin-boundaries",
						paint: {
							"fill-color": "#e5e7eb",
							"fill-opacity": 0.3,
						},
					});
				}

				// Add stroke layer
				let hasAdminStrokeLayer = false;
				try {
					hasAdminStrokeLayer = Boolean(currentMap.getLayer("admin-stroke"));
				} catch {
					return;
				}
				if (!hasAdminStrokeLayer) {
					currentMap.addLayer({
						id: "admin-stroke",
						type: "line",
						source: "admin-boundaries",
						paint: {
							"line-color": "#374151",
							"line-width": 2,
							"line-opacity": 0.8,
						},
					});
				}

				// Update colors immediately
				updateArrondissementColors();

				// Add click handler
				if (hasAdminFillLayer || !hasAdminFillLayer) {
					try {
						currentMap.off("click", "admin-fill", handleAdminFillClick);
					} catch {}
					try {
						currentMap.off(
							"mouseenter",
							"admin-fill",
							handleAdminFillMouseEnter,
						);
					} catch {}
					try {
						currentMap.off(
							"mouseleave",
							"admin-fill",
							handleAdminFillMouseLeave,
						);
					} catch {}
					try {
						currentMap.on("click", "admin-fill", handleAdminFillClick);
						currentMap.on(
							"mouseenter",
							"admin-fill",
							handleAdminFillMouseEnter,
						);
						currentMap.on(
							"mouseleave",
							"admin-fill",
							handleAdminFillMouseLeave,
						);
					} catch {}
				}
			} catch (error) {
				clientLog.error(
					"maps.maplibre",
					"Failed to load boundaries",
					undefined,
					error,
				);
			}
		};

		loadBoundaries();
		return () => {
			isCancelled = true;
			try {
				currentMap.off("click", "admin-fill", handleAdminFillClick);
			} catch {}
			try {
				currentMap.off("mouseenter", "admin-fill", handleAdminFillMouseEnter);
			} catch {}
			try {
				currentMap.off("mouseleave", "admin-fill", handleAdminFillMouseLeave);
			} catch {}
		};
	}, [
		mapLoaded,
		handleAdminFillClick,
		handleAdminFillMouseEnter,
		handleAdminFillMouseLeave,
		updateArrondissementColors,
	]);

	// Add event markers (only when coordinates enabled)
	// react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- teardownEventMarkers removes each MapLibre listener registered below.
	useEffect(() => {
		if (!map.current || !mapLoaded) return () => {};
		const currentMap = map.current;
		const teardownEventMarkers = () => {
			try {
				currentMap.off(
					"click",
					"event-cluster-counts",
					handleEventClusterClick,
				);
			} catch {}
			try {
				currentMap.off(
					"click",
					"event-cluster-badges",
					handleEventClusterClick,
				);
			} catch {}
			try {
				currentMap.off("click", "event-markers", handleEventMarkersClick);
			} catch {}
			try {
				currentMap.off("click", "event-star-markers", handleEventMarkersClick);
			} catch {}
			try {
				currentMap.off("click", "event-stack-counts", handleEventMarkersClick);
			} catch {}
			try {
				currentMap.off(
					"mouseenter",
					"event-markers",
					handleEventMarkersMouseEnter,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseenter",
					"event-star-markers",
					handleEventMarkersMouseEnter,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseenter",
					"event-stack-counts",
					handleEventMarkersMouseEnter,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseenter",
					"event-cluster-counts",
					handleEventMarkersMouseEnter,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseenter",
					"event-cluster-badges",
					handleEventMarkersMouseEnter,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseleave",
					"event-markers",
					handleEventMarkersMouseLeave,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseleave",
					"event-star-markers",
					handleEventMarkersMouseLeave,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseleave",
					"event-stack-counts",
					handleEventMarkersMouseLeave,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseleave",
					"event-cluster-counts",
					handleEventMarkersMouseLeave,
				);
			} catch {}
			try {
				currentMap.off(
					"mouseleave",
					"event-cluster-badges",
					handleEventMarkersMouseLeave,
				);
			} catch {}
			try {
				if (currentMap.getLayer("event-cluster-counts")) {
					currentMap.removeLayer("event-cluster-counts");
				}
			} catch {}
			try {
				if (currentMap.getLayer("event-cluster-badges")) {
					currentMap.removeLayer("event-cluster-badges");
				}
			} catch {}
			try {
				if (currentMap.getLayer("event-star-markers")) {
					currentMap.removeLayer("event-star-markers");
				}
			} catch {}
			try {
				if (currentMap.getLayer("event-stack-counts")) {
					currentMap.removeLayer("event-stack-counts");
				}
			} catch {}
			try {
				if (currentMap.getLayer("event-marker-centers")) {
					currentMap.removeLayer("event-marker-centers");
				}
			} catch {}
			try {
				if (currentMap.getLayer("event-markers")) {
					currentMap.removeLayer("event-markers");
				}
			} catch {}
			try {
				if (currentMap.getLayer("event-marker-halos")) {
					currentMap.removeLayer("event-marker-halos");
				}
			} catch {}
			try {
				if (currentMap.getLayer("event-nearby-rings")) {
					currentMap.removeLayer("event-nearby-rings");
				}
			} catch {}
			try {
				if (currentMap.getSource("events")) {
					currentMap.removeSource("events");
				}
			} catch {}
		};

		teardownEventMarkers();
		if (!areEventPinsVisible) return teardownEventMarkers;

		if (coordinateEventStacks.length === 0) return teardownEventMarkers;

		// Create one map feature per exact coordinate. Real coordinates are never offset.
		const eventsGeoJSON = {
			type: "FeatureCollection" as const,
			features: coordinateEventStacks.map((stack) => {
				const eventCoordinates = stack.coordinates;
				const distanceKm = nearbyLocation
					? calculateDistanceKm(nearbyLocation.coordinates, eventCoordinates)
					: null;
				const isWithinNearbyRadius =
					isNearbyInsideParisMap &&
					distanceKm !== null &&
					distanceKm <= nearbyRadiusKm;
				const isFeatured = stack.events.some((event) =>
					shouldDisplayFeaturedEvent(event),
				);
				const isPromoted = stack.events.some(
					(event) => event.isPromoted === true,
				);
				const isOOOCPick = stack.events.some((event) => event.isOOOCPick);
				const markerRank = isFeatured ? 4 : isPromoted ? 3 : isOOOCPick ? 2 : 1;
				return {
					type: "Feature" as const,
					geometry: {
						type: "Point" as const,
						coordinates: [eventCoordinates.lng, eventCoordinates.lat] as [
							number,
							number,
						],
					},
					properties: {
						id: stack.events[0]?.id,
						eventIds: stack.events.map((event) => event.id).join("|"),
						stackKey: stack.key,
						name: stack.events[0]?.location ?? stack.events[0]?.name ?? "Venue",
						eventCount: stack.events.length,
						isFeatured,
						isPromoted,
						isOOOCPick,
						isWithinNearbyRadius,
						markerRank,
					},
				};
			}),
		};

		// Add source and layer
		currentMap.addSource("events", {
			type: "geojson",
			data: eventsGeoJSON,
			cluster: true,
			clusterMaxZoom: 15,
			clusterRadius: 42,
			clusterProperties: {
				featured_count: ["+", ["case", ["get", "isFeatured"], 1, 0]],
				promoted_count: ["+", ["case", ["get", "isPromoted"], 1, 0]],
				oooc_count: ["+", ["case", ["get", "isOOOCPick"], 1, 0]],
				nearby_count: ["+", ["case", ["get", "isWithinNearbyRadius"], 1, 0]],
				event_count_sum: ["+", ["get", "eventCount"]],
			},
		});

		currentMap.addLayer({
			id: "event-cluster-badges",
			type: "circle",
			source: "events",
			filter: ["has", "point_count"],
			paint: {
				"circle-radius": [
					"step",
					["get", "event_count_sum"],
					17,
					5,
					20,
					12,
					24,
				],
				"circle-color": [
					"case",
					[">", ["get", "featured_count"], 0],
					"#d8a241",
					[">", ["get", "nearby_count"], 0],
					"#2563eb",
					[">", ["get", "promoted_count"], 0],
					"#2f8f8a",
					[">", ["get", "oooc_count"], 0],
					"#b7832d",
					"#49382e",
				],
				"circle-stroke-color": "#fffaf3",
				"circle-stroke-width": 2.5,
				"circle-opacity": 0.96,
			},
		});

		currentMap.addLayer({
			id: "event-cluster-counts",
			type: "symbol",
			source: "events",
			filter: ["has", "point_count"],
			layout: {
				"text-field": ["to-string", ["get", "event_count_sum"]],
				"text-font": MAP_TEXT_FONT,
				"text-size": 12,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
			},
			paint: {
				"text-color": "#fffaf3",
				"text-halo-color": "#49382e",
				"text-halo-width": 0.5,
			},
		});

		currentMap.addLayer({
			id: "event-marker-halos",
			type: "circle",
			source: "events",
			filter: ["!", ["has", "point_count"]],
			layout: {
				"circle-sort-key": ["get", "markerRank"],
			},
			paint: {
				"circle-radius": [
					"case",
					[">", ["get", "eventCount"], 1],
					18,
					["get", "isFeatured"],
					17,
					["get", "isPromoted"],
					15,
					["get", "isOOOCPick"],
					15,
					12,
				],
				"circle-color": [
					"case",
					["get", "isFeatured"],
					"#d8a241",
					["get", "isPromoted"],
					"#2f8f8a",
					["get", "isOOOCPick"],
					"#d8a241",
					"#49382e",
				],
				"circle-opacity": [
					"case",
					[">", ["get", "eventCount"], 1],
					0.28,
					["get", "isFeatured"],
					0.32,
					["get", "isPromoted"],
					0.25,
					["get", "isOOOCPick"],
					0.24,
					0.18,
				],
				"circle-blur": 0.35,
			},
		});

		currentMap.addLayer({
			id: "event-nearby-rings",
			type: "circle",
			source: "events",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["get", "isWithinNearbyRadius"],
			],
			layout: {
				"circle-sort-key": ["get", "markerRank"],
			},
			paint: {
				"circle-radius": [
					"case",
					["get", "isFeatured"],
					18,
					["get", "isPromoted"],
					17,
					["get", "isOOOCPick"],
					17,
					14,
				],
				"circle-color": "#2563eb",
				"circle-opacity": 0.22,
				"circle-stroke-color": "#eff6ff",
				"circle-stroke-width": 1.5,
			},
		});

		currentMap.addLayer({
			id: "event-markers",
			type: "circle",
			source: "events",
			filter: ["!", ["has", "point_count"]],
			layout: {
				"circle-sort-key": ["get", "markerRank"],
			},
			paint: {
				"circle-radius": [
					"case",
					[">", ["get", "eventCount"], 1],
					10.5,
					["get", "isFeatured"],
					9.5,
					["get", "isPromoted"],
					8.5,
					["get", "isOOOCPick"],
					8.5,
					6.5,
				],
				"circle-color": [
					"case",
					["get", "isFeatured"],
					"#d8a241",
					["get", "isPromoted"],
					"#2f8f8a",
					["get", "isOOOCPick"],
					"#d8a241",
					"#49382e",
				],
				"circle-stroke-width": [
					"case",
					[">", ["get", "eventCount"], 1],
					3,
					["get", "isFeatured"],
					3,
					["get", "isOOOCPick"],
					2.5,
					2,
				],
				"circle-stroke-color": "#fffaf3",
				"circle-opacity": isNearbyInsideParisMap
					? ["case", ["get", "isWithinNearbyRadius"], 0.98, 0.42]
					: 0.96,
			},
		});

		currentMap.addLayer({
			id: "event-marker-centers",
			type: "circle",
			source: "events",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["!", ["get", "isFeatured"]],
				["!", ["get", "isPromoted"]],
				["!", ["get", "isOOOCPick"]],
			],
			paint: {
				"circle-radius": 2.6,
				"circle-color": "#d8a241",
				"circle-opacity": isNearbyInsideParisMap
					? ["case", ["get", "isWithinNearbyRadius"], 0.98, 0.45]
					: 0.98,
			},
		});

		currentMap.addLayer({
			id: "event-stack-counts",
			type: "symbol",
			source: "events",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">", ["get", "eventCount"], 1],
			],
			layout: {
				"text-field": ["to-string", ["get", "eventCount"]],
				"text-font": MAP_TEXT_FONT,
				"text-size": 10,
				"text-offset": [0.8, -0.8],
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"symbol-sort-key": ["get", "markerRank"],
			},
			paint: {
				"text-color": "#fffaf3",
				"text-halo-color": "#49382e",
				"text-halo-width": 1.6,
			},
		});

		currentMap.addLayer({
			id: "event-star-markers",
			type: "symbol",
			source: "events",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["any", ["get", "isFeatured"], ["get", "isOOOCPick"]],
			],
			layout: {
				"text-field": "★",
				"text-font": MAP_TEXT_FONT,
				"text-size": 12,
				"text-allow-overlap": true,
				"symbol-sort-key": ["get", "markerRank"],
			},
			paint: {
				"text-color": "#49382e",
			},
		});

		currentMap.on("click", "event-cluster-badges", handleEventClusterClick);
		currentMap.on("click", "event-cluster-counts", handleEventClusterClick);
		currentMap.on("click", "event-markers", handleEventMarkersClick);
		currentMap.on("click", "event-star-markers", handleEventMarkersClick);
		currentMap.on("click", "event-stack-counts", handleEventMarkersClick);
		currentMap.on(
			"mouseenter",
			"event-cluster-badges",
			handleEventMarkersMouseEnter,
		);
		currentMap.on(
			"mouseenter",
			"event-cluster-counts",
			handleEventMarkersMouseEnter,
		);
		currentMap.on("mouseenter", "event-markers", handleEventMarkersMouseEnter);
		currentMap.on(
			"mouseenter",
			"event-star-markers",
			handleEventMarkersMouseEnter,
		);
		currentMap.on(
			"mouseenter",
			"event-stack-counts",
			handleEventMarkersMouseEnter,
		);
		currentMap.on(
			"mouseleave",
			"event-cluster-badges",
			handleEventMarkersMouseLeave,
		);
		currentMap.on(
			"mouseleave",
			"event-cluster-counts",
			handleEventMarkersMouseLeave,
		);
		currentMap.on("mouseleave", "event-markers", handleEventMarkersMouseLeave);
		currentMap.on(
			"mouseleave",
			"event-star-markers",
			handleEventMarkersMouseLeave,
		);
		currentMap.on(
			"mouseleave",
			"event-stack-counts",
			handleEventMarkersMouseLeave,
		);
		return teardownEventMarkers;
	}, [
		mapLoaded,
		coordinateEventStacks,
		areEventPinsVisible,
		isNearbyInsideParisMap,
		nearbyLocation,
		nearbyRadiusKm,
		handleEventClusterClick,
		handleEventMarkersClick,
		handleEventMarkersMouseEnter,
		handleEventMarkersMouseLeave,
	]);

	useEffect(() => {
		if (!map.current || !mapLoaded) return () => {};
		const currentMap = map.current;
		const teardownNearbyLocation = () => {
			for (const layerId of [
				"nearby-user-dot",
				"nearby-user-pulse",
				"nearby-radius-line",
				"nearby-radius-fill",
			]) {
				try {
					if (currentMap.getLayer(layerId)) {
						currentMap.removeLayer(layerId);
					}
				} catch {}
			}
			for (const sourceId of ["nearby-user-location", "nearby-radius"]) {
				try {
					if (currentMap.getSource(sourceId)) {
						currentMap.removeSource(sourceId);
					}
				} catch {}
			}
		};

		teardownNearbyLocation();
		if (!isNearbyInsideParisMap || !nearbyLocation) {
			nearbyViewKeyRef.current = null;
			return teardownNearbyLocation;
		}

		const userPoint: GeoJSON.Feature<GeoJSON.Point> = {
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: [
					nearbyLocation.coordinates.lng,
					nearbyLocation.coordinates.lat,
				],
			},
			properties: {},
		};
		currentMap.addSource("nearby-radius", {
			type: "geojson",
			data: buildNearbyRadiusPolygon(
				nearbyLocation.coordinates,
				nearbyRadiusKm,
			),
		});
		currentMap.addSource("nearby-user-location", {
			type: "geojson",
			data: userPoint,
		});
		const radiusBeforeLayer = currentMap.getLayer("event-nearby-rings")
			? "event-nearby-rings"
			: undefined;
		currentMap.addLayer(
			{
				id: "nearby-radius-fill",
				type: "fill",
				source: "nearby-radius",
				paint: {
					"fill-color": "#2563eb",
					"fill-opacity": 0.13,
				},
			},
			radiusBeforeLayer,
		);
		currentMap.addLayer(
			{
				id: "nearby-radius-line",
				type: "line",
				source: "nearby-radius",
				paint: {
					"line-color": "#2563eb",
					"line-opacity": 0.55,
					"line-width": 1.5,
				},
			},
			radiusBeforeLayer,
		);
		currentMap.addLayer({
			id: "nearby-user-pulse",
			type: "circle",
			source: "nearby-user-location",
			paint: {
				"circle-radius": 15,
				"circle-color": "#2563eb",
				"circle-opacity": 0.18,
				"circle-blur": 0.35,
			},
		});
		currentMap.addLayer({
			id: "nearby-user-dot",
			type: "circle",
			source: "nearby-user-location",
			paint: {
				"circle-radius": 6,
				"circle-color": "#2563eb",
				"circle-stroke-color": "#eff6ff",
				"circle-stroke-width": 2.5,
			},
		});

		const viewKey = `${nearbyLocation.coordinates.lat}:${nearbyLocation.coordinates.lng}:${nearbyRadiusKm}`;
		if (nearbyViewKeyRef.current !== viewKey) {
			nearbyViewKeyRef.current = viewKey;
			currentMap.fitBounds(
				getNearbyRadiusBounds(nearbyLocation.coordinates, nearbyRadiusKm),
				{
					padding: isFullscreen
						? { top: 96, right: 96, bottom: 96, left: 96 }
						: { top: 88, right: 76, bottom: 76, left: 76 },
					maxZoom: 14.4,
					duration: 650,
				},
			);
		}

		return teardownNearbyLocation;
	}, [
		isFullscreen,
		isNearbyInsideParisMap,
		mapLoaded,
		nearbyLocation,
		nearbyRadiusKm,
	]);

	// Error state
	const visibleLoadError = isOfflineMode ? MAP_ONLINE_ONLY_MESSAGE : loadError;

	if (visibleLoadError) {
		return (
			<div
				className={cn(
					"relative h-[600px] w-full overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(160deg,rgba(248,242,236,0.95),rgba(242,232,223,0.82))] dark:bg-[linear-gradient(160deg,rgba(26,20,18,0.95),rgba(20,16,14,0.88))]",
					className,
				)}
			>
				<div className="flex h-full items-center justify-center p-4">
					<div className="ooo-site-card w-full max-w-md rounded-2xl border border-border/75 p-5 text-left shadow-[0_24px_58px_-42px_rgba(16,12,9,0.72)] sm:p-6">
						<div className="mb-3 flex items-start justify-between gap-4">
							<div>
								<p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
									Paris Map
								</p>
								<p className="mt-1 text-sm font-medium text-foreground">
									Map temporarily unavailable
								</p>
							</div>
							{isFullscreen && onFullscreenRequest && (
								<button
									type="button"
									onPointerDown={handleFullscreenPointerDown}
									className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/78 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									aria-label="Exit full screen map"
									title="Exit full screen"
								>
									<Minimize2 className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
						<p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
							{isOfflineMode
								? `${visibleLoadError}. Cached event browsing, search, and filters are still available below.`
								: `${visibleLoadError}. The district map can be retried without losing your current filters.`}
						</p>
						{!isOfflineMode && (
							<button
								onClick={handleMapRetry}
								className="mt-4 inline-flex h-8 items-center justify-center rounded-full border border-border/75 bg-foreground px-4 text-sm text-background transition-colors hover:bg-foreground/88"
								type="button"
							>
								Retry
							</button>
						)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"relative h-[600px] w-full overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.68),rgba(255,255,255,0)_45%),linear-gradient(155deg,rgba(240,233,223,0.86),rgba(227,220,210,0.68))] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.06),rgba(255,255,255,0)_42%),linear-gradient(155deg,rgba(21,18,16,0.94),rgba(28,23,20,0.9))]",
				className,
			)}
		>
			<div
				aria-hidden="true"
				className={cn(
					"absolute inset-0 bg-cover bg-center saturate-[0.92]",
					"motion-safe:transition-opacity motion-safe:duration-250 motion-safe:ease-out",
					mapLoaded ? "opacity-0" : "opacity-80",
				)}
				style={{ backgroundImage: `url('${MAP_PREVIEW_IMAGE_URL}')` }}
			/>
			<div
				aria-hidden="true"
				className={cn(
					"absolute inset-0 bg-card/20",
					"motion-safe:transition-opacity motion-safe:duration-250 motion-safe:ease-out",
					mapLoaded ? "opacity-0" : "opacity-100",
				)}
			/>

			{/* Map container */}
			<div
				ref={mapContainer}
				className={cn(
					"ooo-map-shell absolute inset-0 overflow-hidden rounded-lg",
					"motion-safe:transition-opacity motion-safe:duration-250 motion-safe:ease-out",
					mapLoaded ? "opacity-100" : "opacity-0",
				)}
				style={{ width: "100%", height: "100%" }}
			/>

			{mapLoaded && (
				<div className="absolute right-2 top-2 z-[3] flex flex-col gap-1 rounded-xl border border-border/70 bg-card/88 p-0.5 shadow-[0_14px_30px_-24px_rgba(16,12,9,0.68)] backdrop-blur-md">
					<div className="flex flex-col overflow-hidden rounded-lg border border-border/70 bg-background/92 shadow-sm">
						<button
							type="button"
							onClick={handleZoomIn}
							className="inline-flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label="Zoom in"
						>
							<Plus className="h-3.5 w-3.5" />
						</button>
						<div className="h-px bg-border/70" />
						<button
							type="button"
							onClick={handleZoomOut}
							className="inline-flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label="Zoom out"
						>
							<Minus className="h-3.5 w-3.5" />
						</button>
					</div>
					<div className="relative">
						<button
							type="button"
							onClick={handleLocateClick}
							disabled={nearbyEventsStatus === "requesting"}
							className={cn(
								"inline-flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-65",
								isNearbyActive
									? "border-blue-700 bg-blue-700 text-white hover:bg-blue-800 dark:border-blue-300 dark:bg-blue-300 dark:text-blue-950 dark:hover:bg-blue-200"
									: "border-border/70 bg-background/92 text-foreground hover:bg-accent",
							)}
							aria-pressed={isNearbyActive}
							aria-label={
								nearbyEventsStatus === "requesting"
									? "Locating nearby events"
									: isNearbyActive
										? "Turn off events near me"
										: "Find events near me"
							}
						>
							<Locate className="h-3.5 w-3.5" />
						</button>
						{showLocateNotice && (
							<div className="absolute right-[calc(100%+0.5rem)] top-0 w-56 rounded-xl border border-border/75 bg-popover/96 px-3 py-2 text-left text-xs leading-snug text-popover-foreground shadow-[0_16px_34px_-24px_rgba(16,12,9,0.68)] backdrop-blur-md">
								<p className="font-medium text-foreground">
									Use the event list
								</p>
								<p className="mt-0.5 text-muted-foreground">
									Near me sorting needs the event controls to finish loading.
								</p>
							</div>
						)}
					</div>
					{isFullscreen && onFilterClick && (
						<button
							type="button"
							onClick={() => {
								haptics.nudge();
								onFilterClick();
							}}
							className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/92 text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label="Open event filters"
						>
							<Filter className="h-3.5 w-3.5" />
							{hasActiveFilters && (
								<span className="-right-1 -top-1 absolute inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-medium text-destructive-foreground shadow-sm">
									{activeFiltersCount}
								</span>
							)}
						</button>
					)}
					<button
						type="button"
						onPointerDown={handleFullscreenPointerDown}
						className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/92 text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={
							isFullscreen ? "Close full screen map" : "Open full screen map"
						}
					>
						{isFullscreen ? (
							<Minimize2 className="h-3.5 w-3.5" />
						) : (
							<Maximize2 className="h-3.5 w-3.5" />
						)}
					</button>
				</div>
			)}

			{shouldShowNearbyStatus && (
				<div className="absolute right-14 top-2 z-[3] w-[min(17rem,calc(100%-4.5rem))] rounded-xl border border-border/75 bg-card/92 px-3 py-2 text-xs shadow-[0_16px_34px_-24px_rgba(16,12,9,0.7)] backdrop-blur-md">
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<p className="font-medium text-foreground">
								{nearbyEventsStatus === "requesting"
									? "Locating..."
									: "Near me"}
							</p>
							<p className="mt-0.5 leading-snug text-muted-foreground">
								{nearbyEventsError
									? nearbyEventsError
									: isNearbyOutsideParisMap
										? outsideParisMapCopy
										: isNearbyInsideParisMap
											? `${nearbyMatchedEventsCount} event${
													nearbyMatchedEventsCount === 1 ? "" : "s"
												} within ${nearbyRadiusKm} km.`
											: "Choose Near me to use your location."}
							</p>
						</div>
					</div>
					{isNearbyOutsideParisMap && onNearbyResultsClick && (
						<button
							type="button"
							onClick={() => {
								haptics.selection();
								onNearbyResultsClick();
							}}
							className="mt-2 inline-flex h-7 items-center rounded-full border border-border/75 bg-background/76 px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
						>
							View nearest events
						</button>
					)}
					{canUseParisTestLocation && onParisTestLocationClick && (
						<button
							type="button"
							onClick={() => {
								haptics.selection();
								onParisTestLocationClick();
							}}
							className="mt-2 ml-1 inline-flex h-7 items-center rounded-full border border-blue-700/40 bg-blue-600/10 px-2.5 text-[11px] font-medium text-blue-800 transition-colors hover:bg-blue-600/16 dark:border-blue-300/40 dark:text-blue-200"
						>
							Use Paris test location
						</button>
					)}
					{isNearbyInsideParisMap && nearbyRadiusOptionsKm.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{nearbyRadiusOptionsKm.map((radiusKm) => {
								const isSelected = radiusKm === nearbyRadiusKm;
								return (
									<button
										key={radiusKm}
										type="button"
										onClick={() => {
											haptics.selection();
											onNearbyRadiusChange?.(radiusKm);
										}}
										aria-pressed={isSelected}
										className={cn(
											"h-6 rounded-full border px-2 text-[11px] transition-colors",
											isSelected
												? "border-blue-700 bg-blue-700 text-white dark:border-blue-300 dark:bg-blue-300 dark:text-blue-950"
												: "border-border/70 bg-background/72 text-muted-foreground hover:bg-accent hover:text-foreground",
										)}
									>
										{radiusKm} km
									</button>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* Loading overlay */}
			{isLoading && (
				<div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center rounded-lg">
					<div className="ooo-site-card rounded-2xl border border-border/75 px-5 py-4 text-center">
						<div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-foreground/70"></div>
						<p className="mt-2 text-sm text-foreground/85">
							Loading enhanced map...
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Initializing MapLibre & boundaries
						</p>
					</div>
				</div>
			)}

			{showTileLoadingNotice && !isLoading && (
				<div className="absolute left-3 right-3 bottom-3 z-[3] flex justify-center pointer-events-none sm:left-auto sm:right-3 sm:bottom-3">
					<p className="rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md">
						Map tiles still loading...
					</p>
				</div>
			)}

			{/* Enhanced Legend */}
			{mapLoaded && (
				<div
					className={cn(
						"ooo-site-card absolute top-3 left-3 z-[2] max-w-[min(18rem,calc(100%-5rem))] rounded-2xl border border-border/75 shadow-[0_16px_36px_-28px_rgba(16,12,9,0.55)] backdrop-blur-md sm:top-4 sm:left-4",
						isLegendExpanded ? "p-4" : "p-2.5",
						selectedArrondissement ? "hidden md:block" : "block",
					)}
				>
					{/* Header */}
					<button
						type="button"
						onClick={() => setIsLegendExpanded((current) => !current)}
						className={cn(
							"flex w-full items-center justify-between gap-3 rounded-xl text-left transition-colors hover:bg-background/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							isLegendExpanded ? "-mx-1 -mt-1 mb-3 px-1 py-1" : "px-1 py-0.5",
						)}
						aria-expanded={isLegendExpanded}
						aria-label={
							isLegendExpanded ? "Collapse map key" : "Expand map key"
						}
					>
						<span className="flex min-w-0 items-center gap-2">
							<span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-green-500" />
							<span className="truncate text-sm font-semibold text-foreground">
								{filteredEvents.length} events showing
							</span>
						</span>
						<span className="flex flex-shrink-0 items-center text-muted-foreground">
							<ChevronDown
								className={cn(
									"h-3.5 w-3.5 transition-transform",
									isLegendExpanded ? "rotate-180" : "rotate-0",
								)}
							/>
						</span>
					</button>

					{isLegendExpanded && (
						<>
							{/* Coordinates Toggle */}
							<div className="mb-3 border-b border-border/65 pb-3">
								<label
									className={cn(
										"flex items-center space-x-2",
										canShowCoordinates
											? "cursor-pointer"
											: "cursor-not-allowed",
									)}
								>
									<input
										type="checkbox"
										checked={areEventPinsVisible}
										onChange={(e) => setShowCoordinates(e.target.checked)}
										disabled={!canShowCoordinates}
										className="h-4 w-4 rounded border-border/70 bg-background/70 text-[#7a4f3a] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-45"
									/>
									<div className="flex flex-col">
										<span className="text-sm text-foreground/88">
											Show Event Pins
										</span>
										<span className="text-xs text-muted-foreground">
											{canShowCoordinates
												? `${eventsWithCoordinatesCount} event pin${
														eventsWithCoordinatesCount === 1 ? "" : "s"
													}`
												: "No event pins available yet"}
										</span>
									</div>
								</label>
							</div>

							{/* Event Type Legend */}
							{areEventPinsVisible && (
								<div className="space-y-2 mb-3">
									<div className="flex items-center space-x-2">
										<div className="h-3 w-3 rounded-full border border-white bg-[#49382e] shadow-sm"></div>
										<span className="text-xs text-foreground/82">
											Regular Event
										</span>
									</div>
									<div className="flex items-center space-x-2">
										<div className="h-3 w-3 rounded-full border border-white bg-[#d8a241] shadow-sm"></div>
										<span className="inline-flex items-center gap-1 text-xs text-foreground/82">
											OOOC Pick
											<Star className="h-3 w-3 fill-current text-[#d8a241]" />
										</span>
									</div>
								</div>
							)}

							{/* Interactive Guide */}
							<div className="border-t border-border/65 pt-3">
								<div className="space-y-2 text-xs text-muted-foreground">
									<div className="flex items-center space-x-2">
										<MapPinned className="h-3.5 w-3.5 text-muted-foreground" />
										<span>Click districts to explore events</span>
									</div>
									{areEventPinsVisible && (
										<div className="flex items-center space-x-2">
											<MapPin className="h-3.5 w-3.5 text-muted-foreground" />
											<span>Click markers for event details</span>
										</div>
									)}
									{selectedDay && (
										<div className="mt-2 flex items-center space-x-2 border-t border-border/65 pt-2">
											<CalendarDays className="h-3.5 w-3.5 text-blue-500" />
											<span className="font-medium text-blue-600 dark:text-blue-400">
												Filtered by{" "}
												{selectedDay.charAt(0).toUpperCase() +
													selectedDay.slice(1)}
											</span>
										</div>
									)}
								</div>
							</div>
						</>
					)}
				</div>
			)}

			{/* Color Legend */}
			{mapLoaded && (
				<div
					className={cn(
						"ooo-site-card absolute bottom-3 left-3 z-[2] rounded-xl border border-border/75 px-2.5 py-2 shadow-[0_14px_30px_-24px_rgba(16,12,9,0.55)] backdrop-blur-md sm:bottom-4 sm:left-4",
						isFullscreen ? "px-3 py-2.5" : "",
						selectedArrondissement ? "hidden sm:block" : "block",
					)}
				>
					<h4 className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
						District activity
					</h4>
					<div
						className={cn(
							"grid grid-cols-4 gap-1.5 text-[10px] text-muted-foreground",
							isFullscreen ? "w-64" : "w-36",
						)}
					>
						{DISTRICT_ACTIVITY_LEVELS.map((level) => (
							<div
								aria-label={`${level.label}: ${level.rangeLabel} events`}
								className="flex min-w-0 flex-col items-center gap-1"
								key={level.label}
								title={`${level.label}: ${level.rangeLabel} events`}
							>
								<div
									aria-hidden="true"
									className="h-2 w-full rounded-sm"
									style={{ backgroundColor: level.color }}
								/>
								<span
									className={cn(
										"min-h-3.5 truncate font-medium text-foreground",
										isFullscreen ? "" : "sr-only",
									)}
								>
									{level.label}
								</span>
								<span>{level.rangeLabel}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Exact coordinate event stack */}
			{selectedCoordinateStack && (
				<div className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[4] md:top-3 md:right-3 md:bottom-3 md:left-auto md:w-[25.5rem] md:max-w-[calc(100%-1.5rem)]">
					<div className="ooo-site-card flex max-h-[min(calc(62dvh_-_env(safe-area-inset-bottom)),26rem)] flex-col rounded-2xl border border-border/80 p-3.5 shadow-[0_24px_44px_-32px_rgba(16,12,9,0.6)] backdrop-blur-xl md:max-h-[30rem]">
						<div className="mb-2 flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
									Same Location
								</p>
								<h3 className="truncate text-[1.02rem] [font-family:var(--ooo-font-display)] font-light leading-tight">
									{selectedCoordinateStack.events[0]?.location ||
										"Shared venue"}
								</h3>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{selectedCoordinateStack.events.length} events at this exact
									pin
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									haptics.light();
									setSelectedCoordinateStackKey(null);
								}}
								className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/68 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								aria-label="Close location events"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="mb-2 h-px bg-border/70" />
						<div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
							{selectedCoordinateStack.events.map((event) => {
								const dayNightPeriod = getEventDisplayDayNightPeriod(
									event,
									selectedDayNightPeriods,
								);
								const venueTypes = getEventVenueTypes(event);
								const isFeatured = shouldDisplayFeaturedEvent(event);
								const isPromoted = !isFeatured && event.isPromoted === true;
								const buttonClassName =
									isFeatured && event.isOOOCPick
										? featuredOoocEventButtonClassName
										: isFeatured
											? featuredEventButtonClassName
											: isPromoted
												? promotedEventButtonClassName
												: event.isOOOCPick
													? ooocEventButtonClassName
													: regularEventButtonClassName;

								return (
									<button
										key={event.id}
										type="button"
										className={`${baseEventButtonClassName} ${buttonClassName}`}
										onClick={() => {
											if (isFeatured || event.isOOOCPick) {
												haptics.success();
											} else {
												haptics.selection();
											}
											onEventClick(event);
										}}
									>
										<div className="flex items-center justify-between">
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-1.5">
													<p className="text-sm font-medium text-foreground">
														{event.name}
													</p>
													{isFeatured && (
														<span className="rounded-full border border-rose-400/80 bg-rose-100/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-700 dark:border-rose-400/65 dark:bg-rose-500/20 dark:text-rose-200">
															Featured
														</span>
													)}
													{isPromoted && (
														<span className="rounded-full border border-rose-300/65 bg-rose-50/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-700/85 dark:border-rose-300/45 dark:bg-rose-400/15 dark:text-rose-100/90">
															Featured
														</span>
													)}
													{event.isOOOCPick && (
														<span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/70 bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-200">
															<Star className="h-2.5 w-2.5 fill-current" />
															OOOC
														</span>
													)}
												</div>
												<p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
													<span>{formatEventMapSchedule(event)}</span>
													{dayNightPeriod === "day" ? (
														<Sun className="h-3 w-3" />
													) : dayNightPeriod === "night" ? (
														<Moon className="h-3 w-3" />
													) : null}
												</p>
												<div className="mt-1 flex items-center space-x-1">
													<span className="inline-flex items-center gap-0.5 text-muted-foreground">
														{venueTypes.includes("indoor") && (
															<Building2 className="h-3 w-3" />
														)}
														{venueTypes.includes("outdoor") && (
															<Trees className="h-3 w-3" />
														)}
													</span>
													<Euro className="h-3 w-3 text-muted-foreground" />
													<span
														className={`text-xs ${
															formatPrice(event.price) === "Free"
																? "font-medium text-green-600 dark:text-green-400"
																: "text-muted-foreground"
														}`}
													>
														{formatPrice(event.price)}
													</span>
												</div>
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* Selected arrondissement events */}
			{selectedArrondissement && !selectedCoordinateStack && (
				<div className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[3] md:top-3 md:right-3 md:bottom-3 md:left-auto md:w-[25.5rem] md:max-w-[calc(100%-1.5rem)]">
					<div className="ooo-site-card flex max-h-[min(calc(62dvh_-_env(safe-area-inset-bottom)),26rem)] flex-col rounded-2xl border border-border/80 p-3.5 shadow-[0_24px_44px_-32px_rgba(16,12,9,0.6)] backdrop-blur-xl md:h-full md:max-h-none">
						<div className="mb-2 flex items-start justify-between gap-3">
							<div>
								<p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
									Paris Map
								</p>
								<h3 className="text-[1.02rem] [font-family:var(--ooo-font-display)] font-light leading-tight">
									{selectedArrondissement}e Arrondissement
								</h3>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{selectedArrondissementSummary.total} event
									{selectedArrondissementSummary.total === 1 ? "" : "s"} here
									{" · "}
									{selectedArrondissementSummary.activityLabel}
								</p>
								<div className="mt-2 flex flex-wrap gap-1.5">
									<span className="rounded-full border border-border/70 bg-background/58 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground/80">
										Featured first
									</span>
									{selectedArrondissementSummary.featuredCount > 0 && (
										<span className="rounded-full border border-rose-400/55 bg-rose-100/75 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/12 dark:text-rose-200">
											{selectedArrondissementSummary.featuredCount} featured
										</span>
									)}
									{selectedArrondissementSummary.promotedCount > 0 && (
										<span className="rounded-full border border-rose-300/45 bg-rose-50/65 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-rose-700/80 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-100/85">
											{selectedArrondissementSummary.promotedCount} featured
										</span>
									)}
									{selectedArrondissementSummary.ooocCount > 0 && (
										<span className="rounded-full border border-amber-400/55 bg-amber-100/75 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/12 dark:text-amber-200">
											{selectedArrondissementSummary.ooocCount} OOOC picks
										</span>
									)}
								</div>
							</div>
							<button
								type="button"
								onClick={() => {
									haptics.light();
									setSelectedArrondissement(null);
								}}
								className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/68 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="mb-2 h-px bg-border/70" />
						<div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
							{selectedArrondissementEvents.map((event) => {
								const dayNightPeriod = getEventDisplayDayNightPeriod(
									event,
									selectedDayNightPeriods,
								);
								const venueTypes = getEventVenueTypes(event);
								const isFeatured = shouldDisplayFeaturedEvent(event);
								const isPromoted = !isFeatured && event.isPromoted === true;
								const buttonClassName =
									isFeatured && event.isOOOCPick
										? featuredOoocEventButtonClassName
										: isFeatured
											? featuredEventButtonClassName
											: isPromoted
												? promotedEventButtonClassName
												: event.isOOOCPick
													? ooocEventButtonClassName
													: regularEventButtonClassName;

								return (
									<button
										key={event.id}
										className={`${baseEventButtonClassName} ${buttonClassName}`}
										onClick={() => {
											if (isFeatured || event.isOOOCPick) {
												haptics.success();
											} else {
												haptics.selection();
											}
											onEventClick(event);
										}}
									>
										<div className="flex items-center justify-between">
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-1.5">
													<p className="text-sm font-medium text-foreground">
														{event.name}
													</p>
													{isFeatured && (
														<span className="rounded-full border border-rose-400/80 bg-rose-100/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-700 dark:border-rose-400/65 dark:bg-rose-500/20 dark:text-rose-200">
															Featured
														</span>
													)}
													{isPromoted && (
														<span className="rounded-full border border-rose-300/65 bg-rose-50/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-700/85 dark:border-rose-300/45 dark:bg-rose-400/15 dark:text-rose-100/90">
															Featured
														</span>
													)}
													{event.isOOOCPick && (
														<span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/70 bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-200">
															<Star className="h-2.5 w-2.5 fill-current" />
															OOOC
														</span>
													)}
												</div>
												<p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
													<span>{formatEventMapSchedule(event)}</span>
													{dayNightPeriod === "day" ? (
														<Sun className="h-3 w-3" />
													) : dayNightPeriod === "night" ? (
														<Moon className="h-3 w-3" />
													) : null}
												</p>
												<div className="mt-1 flex items-center space-x-1">
													<span className="inline-flex items-center gap-0.5 text-muted-foreground">
														{venueTypes.includes("indoor") && (
															<Building2 className="h-3 w-3" />
														)}
														{venueTypes.includes("outdoor") && (
															<Trees className="h-3 w-3" />
														)}
													</span>
													<Euro className="h-3 w-3 text-muted-foreground" />
													<span
														className={`text-xs ${
															formatPrice(event.price) === "Free"
																? "font-medium text-green-600 dark:text-green-400"
																: "text-muted-foreground"
														}`}
													>
														{formatPrice(event.price)}
													</span>
												</div>
											</div>
										</div>
									</button>
								);
							})}
							{selectedArrondissementEvents.length === 0 && (
								<div className="rounded-xl border border-border/70 bg-background/55 p-3 text-sm text-muted-foreground">
									No events are currently available in this district for the
									applied filters.
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ParisMapLibre;
