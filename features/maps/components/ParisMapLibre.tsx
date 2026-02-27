"use client";

import maplibregl from "maplibre-gl";
import React, { useState, useEffect, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { shouldDisplayFeaturedEvent } from "@/features/events/featured/utils/timestamp-utils";
import type { Event } from "@/features/events/types";
import { formatPrice, getDayNightPeriod } from "@/features/events/types";
import { clientLog } from "@/lib/platform/client-logger";
import { cn } from "@/lib/utils";
import {
	Building2,
	CalendarDays,
	Euro,
	MapPin,
	MapPinned,
	Moon,
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

const ParisMapLibre: React.FC<ParisMapLibreProps> = ({
	events,
	onEventClick,
	selectedDay,
}) => {
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<maplibregl.Map | null>(null);
	const [mapLoaded, setMapLoaded] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedArrondissement, setSelectedArrondissement] = useState<
		number | null
	>(null);
	const [showCoordinates, setShowCoordinates] = useState(false);
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
					maxBounds: [
						[2.18, 48.8], // Southwest corner (medium expansion)
						[2.51, 48.92], // Northeast corner (medium expansion)
					],
				});

				// Add navigation controls
				map.current.addControl(new maplibregl.NavigationControl(), "top-right");

				map.current.on("load", () => {
					setMapLoaded(true);
					setIsLoading(false);
				});

				map.current.on("error", (e: maplibregl.ErrorEvent) => {
					clientLog.error("maps.maplibre", "Map loading error", undefined, e);
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
				currentMap.off("click", "event-markers", handleEventMarkersClick);
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
					"mouseleave",
					"event-markers",
					handleEventMarkersMouseLeave,
				);
			} catch {}
			try {
				if (currentMap.getLayer("event-markers")) {
					currentMap.removeLayer("event-markers");
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
		});

		currentMap.addLayer({
			id: "event-markers",
			type: "circle",
			source: "events",
			paint: {
				"circle-radius": ["case", ["get", "isOOOCPick"], 8, 6],
				"circle-color": ["case", ["get", "isOOOCPick"], "#fbbf24", "#3b82f6"],
				"circle-stroke-width": 2,
				"circle-stroke-color": "#ffffff",
				"circle-opacity": 0.9,
			},
		});

		currentMap.on("click", "event-markers", handleEventMarkersClick);
		currentMap.on("mouseenter", "event-markers", handleEventMarkersMouseEnter);
		currentMap.on("mouseleave", "event-markers", handleEventMarkersMouseLeave);
		return () => {
			teardownEventMarkers();
		};
	}, [
		mapLoaded,
		filteredEvents,
		showCoordinates,
		handleEventMarkersClick,
		handleEventMarkersMouseEnter,
		handleEventMarkersMouseLeave,
	]);

	// Error state
	if (loadError) {
		return (
			<div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(160deg,rgba(248,242,236,0.95),rgba(242,232,223,0.82))] dark:bg-[linear-gradient(160deg,rgba(26,20,18,0.95),rgba(20,16,14,0.88))]">
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
		<div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.68),rgba(255,255,255,0)_45%),linear-gradient(155deg,rgba(240,233,223,0.86),rgba(227,220,210,0.68))] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.06),rgba(255,255,255,0)_42%),linear-gradient(155deg,rgba(21,18,16,0.94),rgba(28,23,20,0.9))]">
			{/* Map container */}
			<div
				ref={mapContainer}
				className="absolute inset-0 rounded-lg overflow-hidden"
				style={{ width: "100%", height: "100%" }}
			/>

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
						<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<h3 className="text-sm font-semibold text-foreground">
							{filteredEvents.length} events showing
						</h3>
					</div>

					{/* Coordinates Toggle */}
					<div className="mb-3 border-b border-border/65 pb-3">
						<label className="flex items-center space-x-2 cursor-not-allowed">
							<input
								type="checkbox"
								checked={showCoordinates}
								onChange={(e) => setShowCoordinates(e.target.checked)}
								disabled={true}
								className="h-4 w-4 rounded border-border/70 bg-background/70 text-blue-600 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
							/>
							<div className="flex flex-col">
								<span className="text-sm text-foreground/88">
									Show Event Pins
								</span>
								<span className="text-xs text-muted-foreground">
									Coming soon
								</span>
							</div>
						</label>
					</div>

					{/* Event Type Legend */}
					{showCoordinates && (
						<div className="space-y-2 mb-3">
							<div className="flex items-center space-x-2">
								<div className="w-3 h-3 rounded-full bg-blue-500"></div>
								<span className="text-xs text-foreground/82">
									Regular Event
								</span>
							</div>
							<div className="flex items-center space-x-2">
								<div className="w-3 h-3 rounded-full bg-yellow-400"></div>
								<span className="inline-flex items-center gap-1 text-xs text-foreground/82">
									OOOC Pick
									<Star className="h-3 w-3 fill-current text-yellow-500" />
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
										Filtered by {selectedDay}
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
						"ooo-site-card absolute bottom-3 left-3 z-[2] rounded-xl border border-border/75 p-3 shadow-[0_16px_36px_-28px_rgba(16,12,9,0.55)] backdrop-blur-md sm:bottom-4 sm:left-4",
						selectedArrondissement ? "hidden sm:block" : "block",
					)}
				>
					<h4 className="mb-2 text-xs font-medium text-foreground">
						District Colors
					</h4>
					<div className="space-y-1">
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-gray-300"></div>
							<span className="text-xs text-muted-foreground">0 events</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-green-600"></div>
							<span className="text-xs text-muted-foreground">1 event</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-orange-600"></div>
							<span className="text-xs text-muted-foreground">2-4 events</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-red-600"></div>
							<span className="text-xs text-muted-foreground">5+ events</span>
						</div>
						<div className="mt-1 flex items-center space-x-2">
							<div className="h-2 w-3 rounded-sm bg-blue-700"></div>
							<span className="text-xs text-muted-foreground">
								Selected district
							</span>
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
									{selectedArrondissement}e Arrondissement Events
								</h3>
								<p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/85">
									Featured first, then promoted
								</p>
								<div className="mt-2 flex flex-wrap gap-1.5">
									<span className="rounded-full border border-border/70 bg-background/58 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-foreground/80">
										{selectedArrondissementSummary.total} events
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
													<span>
														{event.time} • {event.day}
													</span>
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
