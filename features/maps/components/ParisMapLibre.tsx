"use client";

import maplibregl from "maplibre-gl";
import React, { useState, useEffect, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import type { Event } from "@/features/events/types";
import {
	formatDayWithDate,
	formatPrice,
	getDayNightPeriod,
} from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import { cn } from "@/lib/utils";
import {
	Building2,
	CalendarDays,
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
}

// Paris center coordinates
const PARIS_CENTER: [number, number] = [2.3522, 48.8566]; // [lng, lat]

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

/**
 * Gets the appropriate fill color for an arrondissement based on event count
 * @param eventCount - Number of events in the arrondissement
 * @returns Hex color string for the arrondissement fill
 */
const getArrondissementFillColor = (eventCount: number): string => {
	if (eventCount === 0) return ARRONDISSEMENT_COLORS.EMPTY;
	if (eventCount >= 5) return ARRONDISSEMENT_COLORS.HIGH;
	if (eventCount >= 2) return ARRONDISSEMENT_COLORS.MEDIUM;
	if (eventCount >= 1) return ARRONDISSEMENT_COLORS.LOW;
	return ARRONDISSEMENT_COLORS.EMPTY;
};

const getDistrictActivityLabel = (eventCount: number): string => {
	if (eventCount >= 5) return "High activity district";
	if (eventCount >= 2) return "Medium activity district";
	if (eventCount === 1) return "Low activity district";
	return "No current events";
};

const formatEventMapSchedule = (event: Event): string => {
	const dateLabel = formatDayWithDate(event.day, event.date);
	const hasStartTime = Boolean(event.time && event.time !== "TBC");
	const hasEndTime = Boolean(event.endTime && event.endTime !== "TBC");

	if (!hasStartTime) return `${dateLabel} • Time TBC`;
	if (hasEndTime) return `${dateLabel} • ${event.time} - ${event.endTime}`;
	return `${dateLabel} • ${event.time}`;
};

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
}) => {
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<maplibregl.Map | null>(null);
	const hasLoadedMapRef = useRef(false);
	const locateNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const [mapLoaded, setMapLoaded] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedArrondissement, setSelectedArrondissement] = useState<
		number | null
	>(null);
	const [showCoordinates, setShowCoordinates] = useState(false);
	const [showLocateNotice, setShowLocateNotice] = useState(false);
	const [isOffline, setIsOffline] = useState(false);

	useEffect(() => {
		if (typeof navigator === "undefined") return;

		setIsOffline(!navigator.onLine);

		const handleOnline = () => setIsOffline(false);
		const handleOffline = () => setIsOffline(true);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

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

	const canShowCoordinates = eventsWithCoordinatesCount > 0;

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
		"border-rose-300/80 bg-[linear-gradient(145deg,rgba(255,236,239,0.92),rgba(255,221,229,0.78))] hover:bg-[linear-gradient(145deg,rgba(255,236,239,0.97),rgba(255,221,229,0.86))] dark:border-rose-500/45 dark:bg-[linear-gradient(145deg,rgba(86,31,45,0.46),rgba(68,24,35,0.34))]";
	const promotedEventButtonClassName =
		"border-amber-500/45 bg-[linear-gradient(145deg,rgba(250,241,223,0.8),rgba(245,236,222,0.7))] hover:bg-[linear-gradient(145deg,rgba(252,243,227,0.9),rgba(247,238,224,0.82))] dark:border-amber-600/45 dark:bg-[linear-gradient(145deg,rgba(80,60,36,0.4),rgba(58,43,27,0.32))]";
	const ooocEventButtonClassName =
		"border-amber-300/75 bg-[linear-gradient(145deg,rgba(248,238,222,0.86),rgba(244,229,205,0.72))] dark:border-amber-500/40 dark:bg-[linear-gradient(145deg,rgba(65,49,30,0.45),rgba(47,36,24,0.32))]";
	const featuredOoocEventButtonClassName =
		"border-[color:color-mix(in_oklab,#f59e0b_52%,#fb7185_48%)] bg-[linear-gradient(145deg,rgba(255,241,228,0.95),rgba(255,226,219,0.82))] dark:border-[color:color-mix(in_oklab,#f59e0b_48%,#fb7185_52%)] dark:bg-[linear-gradient(145deg,rgba(88,53,33,0.5),rgba(87,33,45,0.36))]";

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
			setSelectedArrondissement((current) =>
				current === arrondissement ? null : arrondissement,
			);
		},
		[],
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
			const eventId = e.features?.[0]?.properties?.id;
			if (typeof eventId !== "string") return;
			const event = eventsById.get(eventId);
			if (event) {
				onEventClick(event);
			}
		},
		[eventsById, onEventClick],
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

			const source = map.current.getSource("events");
			if (!source || !("getClusterExpansionZoom" in source)) return;

			const geoJsonSource = source as maplibregl.GeoJSONSource;
			geoJsonSource.getClusterExpansionZoom(clusterId).then((zoom) => {
				if (!map.current) return;
				map.current.easeTo({
					center: e.lngLat,
					zoom,
					duration: 650,
				});
			});
		},
		[],
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
		map.current?.zoomTo(map.current.getZoom() + 1, { duration: 300 });
	}, []);

	const handleZoomOut = useCallback(() => {
		map.current?.zoomTo(map.current.getZoom() - 1, { duration: 300 });
	}, []);

	const handleLocateClick = useCallback(() => {
		setShowLocateNotice(true);
		if (locateNoticeTimeoutRef.current) {
			clearTimeout(locateNoticeTimeoutRef.current);
		}
		locateNoticeTimeoutRef.current = setTimeout(() => {
			setShowLocateNotice(false);
		}, 3600);
	}, []);

	const handleFullscreenClick = useCallback(() => {
		onFullscreenRequest?.();
	}, [onFullscreenRequest]);

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
		};
	}, []);

	// Initialize map with proper cleanup
	useEffect(() => {
		if (!mapContainer.current || map.current) return;

		const initMap = async () => {
			try {
				setIsLoading(true);
				setLoadError(null);

				// Initialize map
				map.current = new maplibregl.Map({
					container: mapContainer.current!,
					style: "https://tiles.openfreemap.org/styles/liberty",
					center: PARIS_CENTER,
					zoom: 11,
					minZoom: 10,
					maxZoom: 18,
					dragRotate: false,
					touchPitch: false,
					touchZoomRotate: false,
					attributionControl: {
						compact: true,
						customAttribution: "Paris Event Map",
					},
					maxBounds: [
						[2.18, 48.8], // Southwest corner (medium expansion)
						[2.51, 48.92], // Northeast corner (medium expansion)
					],
				});

				map.current.on("load", () => {
					hasLoadedMapRef.current = true;
					setMapLoaded(true);
					setIsLoading(false);
					const collapseAttribution = () => {
						const attribution = mapContainer.current?.querySelector(
							".maplibregl-ctrl-attrib.maplibregl-compact",
						);
						attribution?.classList.remove("maplibregl-compact-show");
						attribution?.classList.add("ooo-attribution-ready");
					};
					window.requestAnimationFrame(collapseAttribution);
					window.setTimeout(collapseAttribution, 200);
				});

				map.current.on("error", (e: maplibregl.ErrorEvent) => {
					if (hasLoadedMapRef.current) {
						clientLog.warn("maps.maplibre", "Non-fatal map tile error", {
							message: e.error.message,
						});
						return;
					}

					clientLog.error("maps.maplibre", "Map loading error", {
						message: e.error.message,
					});
					setLoadError("Failed to load map tiles");
					setIsLoading(false);
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

		initMap();

		// Proper cleanup function
		return () => {
			const currentMap = map.current;
			if (!currentMap) return;
			try {
				currentMap.remove();
			} catch (error) {
				clientLog.warn("maps.maplibre", "Map cleanup error", {
					error: error instanceof Error ? error.message : String(error),
				});
			} finally {
				map.current = null;
			}
		};
	}, []);

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
				// Lazy load GeoJSON data
				const { default: arrondissementData } = await import(
					"@/data/paris-arr-v2.json"
				);
				if (isCancelled) return;

				// Type assert the data to use our interface
				const typedData = arrondissementData as GeoJSON.FeatureCollection & {
					features: ParisArrondissementFeature[];
				};

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
						data: typedData,
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
	useEffect(() => {
		if (!map.current || !mapLoaded) return;
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
				currentMap.off("click", "event-markers", handleEventMarkersClick);
			} catch {}
			try {
				currentMap.off("click", "event-star-markers", handleEventMarkersClick);
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
					"event-cluster-counts",
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
					"event-cluster-counts",
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
				if (currentMap.getSource("events")) {
					currentMap.removeSource("events");
				}
			} catch {}
		};

		teardownEventMarkers();
		if (!showCoordinates) return;

		// Filter events with coordinates
		const eventsWithCoords = filteredEvents.filter(
			(event) =>
				event.coordinates &&
				typeof event.coordinates.lat === "number" &&
				typeof event.coordinates.lng === "number" &&
				!isNaN(event.coordinates.lat) &&
				!isNaN(event.coordinates.lng),
		);

		if (eventsWithCoords.length === 0) return;

		// Create GeoJSON for events
		const eventsGeoJSON = {
			type: "FeatureCollection" as const,
			features: eventsWithCoords.map((event) => ({
				type: "Feature" as const,
				geometry: {
					type: "Point" as const,
					coordinates: [event.coordinates!.lng, event.coordinates!.lat] as [
						number,
						number,
					],
				},
				properties: {
					id: event.id,
					name: event.name,
					isOOOCPick: event.isOOOCPick || false,
				},
			})),
		};

		// Add source and layer
		currentMap.addSource("events", {
			type: "geojson",
			data: eventsGeoJSON,
			cluster: true,
			clusterMaxZoom: 15,
			clusterRadius: 42,
		});

		currentMap.addLayer({
			id: "event-cluster-badges",
			type: "circle",
			source: "events",
			filter: ["has", "point_count"],
			paint: {
				"circle-radius": ["step", ["get", "point_count"], 17, 5, 20, 12, 24],
				"circle-color": "#49382e",
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
				"text-field": ["get", "point_count_abbreviated"],
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
			paint: {
				"circle-radius": ["case", ["get", "isOOOCPick"], 15, 12],
				"circle-color": ["case", ["get", "isOOOCPick"], "#d8a241", "#49382e"],
				"circle-opacity": ["case", ["get", "isOOOCPick"], 0.24, 0.18],
				"circle-blur": 0.35,
			},
		});

		currentMap.addLayer({
			id: "event-markers",
			type: "circle",
			source: "events",
			filter: ["!", ["has", "point_count"]],
			paint: {
				"circle-radius": ["case", ["get", "isOOOCPick"], 8.5, 6.5],
				"circle-color": ["case", ["get", "isOOOCPick"], "#d8a241", "#49382e"],
				"circle-stroke-width": ["case", ["get", "isOOOCPick"], 2.5, 2],
				"circle-stroke-color": "#fffaf3",
				"circle-opacity": 0.96,
			},
		});

		currentMap.addLayer({
			id: "event-marker-centers",
			type: "circle",
			source: "events",
			filter: [
				"all",
				["!", ["has", "point_count"]],
				["!", ["get", "isOOOCPick"]],
			],
			paint: {
				"circle-radius": 2.6,
				"circle-color": "#d8a241",
				"circle-opacity": 0.98,
			},
		});

		currentMap.addLayer({
			id: "event-star-markers",
			type: "symbol",
			source: "events",
			filter: ["all", ["!", ["has", "point_count"]], ["get", "isOOOCPick"]],
			layout: {
				"text-field": "★",
				"text-size": 12,
				"text-allow-overlap": true,
			},
			paint: {
				"text-color": "#49382e",
			},
		});

		currentMap.on("click", "event-cluster-counts", handleEventClusterClick);
		currentMap.on("click", "event-markers", handleEventMarkersClick);
		currentMap.on("click", "event-star-markers", handleEventMarkersClick);
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
		return () => {
			teardownEventMarkers();
		};
	}, [
		mapLoaded,
		filteredEvents,
		showCoordinates,
		handleEventClusterClick,
		handleEventMarkersClick,
		handleEventMarkersMouseEnter,
		handleEventMarkersMouseLeave,
	]);

	// Error state
	if (loadError) {
		return (
			<div
				className={cn(
					"relative h-[600px] w-full overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(160deg,rgba(248,242,236,0.95),rgba(242,232,223,0.82))] dark:bg-[linear-gradient(160deg,rgba(26,20,18,0.95),rgba(20,16,14,0.88))]",
					className,
				)}
			>
				<div className="flex h-full items-center justify-center p-4">
					<div className="ooo-site-card w-full max-w-md rounded-2xl border border-border/75 p-6 text-center">
						<div className="mb-2 text-red-600 dark:text-red-400">
							⚠️ Map Load Error
						</div>
						<p className="text-sm text-red-700 dark:text-red-300">
							{loadError}
						</p>
						{isOffline ? (
							<p className="mt-2 text-xs text-red-700/80 dark:text-red-300/80">
								You are offline. The events list is still available below.
							</p>
						) : (
							<button
								onClick={() => window.location.reload()}
								className="mt-4 inline-flex h-8 items-center justify-center rounded-full border border-red-600/30 bg-red-600 px-4 text-sm text-white transition-colors hover:bg-red-700"
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
			{/* Map container */}
			<div
				ref={mapContainer}
				className="ooo-map-shell absolute inset-0 rounded-lg overflow-hidden"
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
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/92 text-foreground shadow-sm transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label="Find events near me"
						>
							<Locate className="h-3.5 w-3.5" />
						</button>
						{showLocateNotice && (
							<div className="absolute right-[calc(100%+0.5rem)] top-0 w-56 rounded-xl border border-border/75 bg-popover/96 px-3 py-2 text-left text-xs leading-snug text-popover-foreground shadow-[0_16px_34px_-24px_rgba(16,12,9,0.68)] backdrop-blur-md">
								<p className="font-medium text-foreground">
									Near me is coming soon
								</p>
								<p className="mt-0.5 text-muted-foreground">
									It will map events closest to your location.
								</p>
							</div>
						)}
					</div>
					{isFullscreen && onFilterClick && (
						<button
							type="button"
							onClick={onFilterClick}
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

			{/* Loading overlay */}
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/62 backdrop-blur-[3px]">
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

			{/* Enhanced Legend */}
			{mapLoaded && (
				<div
					className={cn(
						"ooo-site-card absolute top-3 left-3 z-[2] max-w-xs rounded-2xl border border-border/75 p-4 shadow-[0_16px_36px_-28px_rgba(16,12,9,0.55)] backdrop-blur-md sm:top-4 sm:left-4",
						selectedArrondissement ? "hidden md:block" : "block",
					)}
				>
					{/* Header */}
					<div className="flex items-center space-x-2 mb-3">
						<div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
						<h3 className="text-sm font-semibold text-foreground">
							{filteredEvents.length} events showing
						</h3>
					</div>

					{/* Coordinates Toggle */}
					<div className="mb-3 border-b border-border/65 pb-3">
						<label
							className={cn(
								"flex items-center space-x-2",
								canShowCoordinates ? "cursor-pointer" : "cursor-not-allowed",
							)}
						>
							<input
								type="checkbox"
								checked={showCoordinates}
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
										? `${eventsWithCoordinatesCount} precise venue pin${
												eventsWithCoordinatesCount === 1 ? "" : "s"
											}`
										: "No precise venue coordinates yet"}
								</span>
							</div>
						</label>
					</div>

					{/* Event Type Legend */}
					{showCoordinates && (
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
							{showCoordinates && (
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
										{selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Color Legend */}
			{mapLoaded && (
				<div
					className={cn(
						"ooo-site-card absolute bottom-3 left-3 z-[2] rounded-xl border border-border/75 px-2.5 py-2 shadow-[0_14px_30px_-24px_rgba(16,12,9,0.55)] backdrop-blur-md sm:bottom-4 sm:left-4",
						selectedArrondissement ? "hidden sm:block" : "block",
					)}
				>
					<h4 className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
						District activity
					</h4>
					<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
						<div className="flex flex-col items-center gap-1">
							<div className="h-2 w-4 rounded-sm bg-gray-300" />
							<span>0</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<div className="h-2 w-4 rounded-sm bg-green-600" />
							<span>1</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<div className="h-2 w-4 rounded-sm bg-orange-600" />
							<span>2-4</span>
						</div>
						<div className="flex flex-col items-center gap-1">
							<div className="h-2 w-4 rounded-sm bg-red-600" />
							<span>5+</span>
						</div>
					</div>
				</div>
			)}

			{/* Selected arrondissement events */}
			{selectedArrondissement && (
				<div className="absolute inset-x-2 bottom-2 z-[3] md:top-3 md:right-3 md:bottom-3 md:left-auto md:w-[25.5rem] md:max-w-[calc(100%-1.5rem)]">
					<div className="ooo-site-card flex max-h-[min(62svh,26rem)] flex-col rounded-2xl border border-border/80 p-3.5 shadow-[0_24px_44px_-32px_rgba(16,12,9,0.6)] backdrop-blur-xl md:h-full md:max-h-none">
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
										<span className="rounded-full border border-amber-500/55 bg-amber-100/75 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-700 dark:border-amber-400/45 dark:bg-amber-500/12 dark:text-amber-200">
											{selectedArrondissementSummary.promotedCount} promoted
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
								onClick={() => setSelectedArrondissement(null)}
								className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/68 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
						<div className="mb-2 h-px bg-border/70" />
						<div className="space-y-2 overflow-y-auto pr-1 md:flex-1 md:min-h-0">
							{selectedArrondissementEvents.map((event) => {
								const dayNightPeriod = getDayNightPeriod(event.time ?? "");
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
										onClick={() => onEventClick(event)}
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
														<span className="rounded-full border border-amber-500/80 bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-200">
															Promoted
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
