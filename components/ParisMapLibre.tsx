"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Event } from "@/types/events";
import { formatPrice } from "@/types/events";
import { Euro, Star } from "lucide-react";

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
	const map = useRef<any>(null);
	const [mapLoaded, setMapLoaded] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedArrondissement, setSelectedArrondissement] = useState<number | null>(null);
	const [showCoordinates, setShowCoordinates] = useState(false);

	// Filter events based on selected day
	const filteredEvents = React.useMemo(() => {
		return events.filter((event) => {
			const dayMatches = !selectedDay || event.day === selectedDay;
			return dayMatches;
		});
	}, [events, selectedDay]);

	// Get events in specific arrondissement
	const getEventsInArrondissement = useCallback((arrondissement: number) => {
		return filteredEvents.filter(
			(event) => event.arrondissement === arrondissement,
		);
	}, [filteredEvents]);

	// Update arrondissement colors based on event density
	const updateArrondissementColors = useCallback(() => {
		if (!map.current || !mapLoaded) return;

		// Count events per arrondissement
		const eventCounts: Record<number, number> = {};
		for (let i = 1; i <= 20; i++) {
			eventCounts[i] = getEventsInArrondissement(i).length;
		}

		// Create color expression for MapLibre
		const colorExpression: any[] = ["case"];

		// Add selected arrondissement (always blue)
		if (selectedArrondissement) {
			colorExpression.push(
				["==", ["get", "c_ar"], selectedArrondissement],
				"#1d4ed8",
			);
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
		if (map.current.getLayer("admin-fill")) {
			map.current.setPaintProperty("admin-fill", "fill-color", colorExpression);
		}
	}, [mapLoaded, selectedArrondissement, getEventsInArrondissement]);

	// Initialize map with lazy loading
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
						[2.224, 48.815], // Southwest corner
						[2.47, 48.902], // Northeast corner
					],
				});

				// Add navigation controls
				map.current.addControl(new maplibregl.NavigationControl(), "top-right");

				map.current.on("load", () => {
					setMapLoaded(true);
					setIsLoading(false);
				});

				map.current.on("error", (e: any) => {
					console.error("Map loading error:", e);
					setLoadError("Failed to load map tiles");
					setIsLoading(false);
				});

			} catch (error) {
				console.error("Failed to initialize map:", error);
				setLoadError(error instanceof Error ? error.message : "Failed to load map");
				setIsLoading(false);
			}
		};

		initMap();

		return () => {
			if (map.current) {
				map.current.remove();
				map.current = null;
				setMapLoaded(false);
			}
		};
	}, []);

	// Load boundaries with lazy loading
	useEffect(() => {
		if (!map.current || !mapLoaded) return;

		const loadBoundaries = async () => {
			try {
				// Lazy load GeoJSON data
				const { default: arrondissementData } = await import("@/data/paris-arr-v2.json");

				// Check if source already exists
				if (!map.current.getSource("admin-boundaries")) {
					map.current.addSource("admin-boundaries", {
						type: "geojson",
						data: arrondissementData,
					});
				}

				// Add fill layer
				if (!map.current.getLayer("admin-fill")) {
					map.current.addLayer({
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
				if (!map.current.getLayer("admin-stroke")) {
					map.current.addLayer({
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
				if (map.current.getLayer("admin-fill")) {
					map.current.on("click", "admin-fill", (e: any) => {
						if (e.features && e.features[0]) {
							const properties = e.features[0].properties as ParisArrondissementProperties;
							const arrondissement = properties.c_ar;
							
							if (arrondissement) {
								setSelectedArrondissement(
									selectedArrondissement === arrondissement ? null : arrondissement,
								);
							}
						}
					});

					// Add hover effects
					map.current.on("mouseenter", "admin-fill", () => {
						if (map.current) {
							map.current.getCanvas().style.cursor = "pointer";
						}
					});

					map.current.on("mouseleave", "admin-fill", () => {
						if (map.current) {
							map.current.getCanvas().style.cursor = "";
						}
					});
				}

			} catch (error) {
				console.error("Failed to load boundaries:", error);
			}
		};

		loadBoundaries();
	}, [mapLoaded, selectedArrondissement, updateArrondissementColors]);

	// Update colors when events change
	useEffect(() => {
		updateArrondissementColors();
	}, [filteredEvents, updateArrondissementColors]);

	// Add event markers (only when coordinates enabled)
	useEffect(() => {
		if (!map.current || !mapLoaded || !showCoordinates) return;

		// Remove existing markers
		if (map.current.getSource("events")) {
			map.current.removeLayer("event-markers");
			map.current.removeSource("events");
		}

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
					coordinates: [event.coordinates!.lng, event.coordinates!.lat] as [number, number],
				},
				properties: {
					id: event.id,
					name: event.name,
					isOOOCPick: event.isOOOCPick || false,
				},
			})),
		};

		// Add source and layer
		map.current.addSource("events", {
			type: "geojson",
			data: eventsGeoJSON,
		});

		map.current.addLayer({
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

		// Add click handler
		map.current.on("click", "event-markers", (e: any) => {
			if (e.features && e.features[0]) {
				const eventId = e.features[0].properties?.id;
				const event = eventsWithCoords.find((e) => e.id === eventId);
				if (event) {
					onEventClick(event);
				}
			}
		});

		// Add hover effects  
		map.current.on("mouseenter", "event-markers", () => {
			if (map.current) {
				map.current.getCanvas().style.cursor = "pointer";
			}
		});

		map.current.on("mouseleave", "event-markers", () => {
			if (map.current) {
				map.current.getCanvas().style.cursor = "";
			}
		});

	}, [mapLoaded, filteredEvents, onEventClick, showCoordinates]);

	// Error state
	if (loadError) {
		return (
			<div className="relative w-full h-[600px] bg-red-50 dark:bg-red-900/20 rounded-lg overflow-hidden flex items-center justify-center">
				<div className="text-center p-6">
					<div className="text-red-600 dark:text-red-400 mb-2">⚠️ Map Load Error</div>
					<p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
					<button 
						onClick={() => window.location.reload()}
						className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="relative w-full h-[600px] bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 rounded-lg overflow-hidden">
			{/* Map container */}
			<div
				ref={mapContainer}
				className="absolute inset-0 rounded-lg overflow-hidden"
				style={{ width: "100%", height: "100%" }}
			/>

			{/* Loading overlay */}
			{isLoading && (
				<div className="absolute inset-0 bg-gray-100 bg-opacity-75 flex items-center justify-center rounded-lg">
					<div className="text-center">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
						<p className="mt-2 text-sm text-gray-600">
							Loading enhanced map...
						</p>
						<p className="mt-1 text-xs text-gray-500">
							Initializing MapLibre & boundaries
						</p>
					</div>
				</div>
			)}

			{/* Enhanced Legend */}
			{mapLoaded && (
				<div className="absolute top-4 left-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs border border-gray-200 dark:border-gray-700">
					{/* Header */}
					<div className="flex items-center space-x-2 mb-3">
						<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
							{filteredEvents.length} events showing
						</h3>
					</div>

					{/* Coordinates Toggle */}
					<div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-600">
						<label className="flex items-center space-x-2 cursor-pointer">
							<input
								type="checkbox"
								checked={showCoordinates}
								onChange={(e) => setShowCoordinates(e.target.checked)}
								className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
							/>
							<span className="text-sm text-gray-700 dark:text-gray-300">
								Show Event Pins
							</span>
						</label>
					</div>

					{/* Event Type Legend */}
					{showCoordinates && (
						<div className="space-y-2 mb-3">
							<div className="flex items-center space-x-2">
								<div className="w-3 h-3 rounded-full bg-blue-500"></div>
								<span className="text-xs text-gray-700 dark:text-gray-300">
									Regular Event
								</span>
							</div>
							<div className="flex items-center space-x-2">
								<div className="w-3 h-3 rounded-full bg-yellow-400"></div>
								<span className="text-xs text-gray-700 dark:text-gray-300">
									OOOC Pick 🌟
								</span>
							</div>
						</div>
					)}

					{/* Interactive Guide */}
					<div className="pt-3 border-t border-gray-200 dark:border-gray-600">
						<div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
							<div className="flex items-center space-x-2">
								<span className="text-gray-400">🗺️</span>
								<span>Click districts to explore events</span>
							</div>
							{showCoordinates && (
								<div className="flex items-center space-x-2">
									<span className="text-gray-400">📍</span>
									<span>Click markers for event details</span>
								</div>
							)}
							{selectedDay && (
								<div className="flex items-center space-x-2 pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
									<span className="text-blue-500">📅</span>
									<span className="text-blue-600 dark:text-blue-400 font-medium">
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
				<div className="absolute bottom-4 left-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
					<h4 className="font-medium text-xs text-gray-900 dark:text-gray-100 mb-2">
						District Colors
					</h4>
					<div className="space-y-1">
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-gray-300"></div>
							<span className="text-xs text-gray-600 dark:text-gray-400">0 events</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-green-600"></div>
							<span className="text-xs text-gray-600 dark:text-gray-400">1 event</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-orange-600"></div>
							<span className="text-xs text-gray-600 dark:text-gray-400">2-4 events</span>
						</div>
						<div className="flex items-center space-x-2">
							<div className="w-3 h-2 rounded-sm bg-red-600"></div>
							<span className="text-xs text-gray-600 dark:text-gray-400">5+ events</span>
						</div>
					</div>
				</div>
			)}

			{/* Selected arrondissement events */}
			{selectedArrondissement && (
				<div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-sm">
					<div className="flex items-center justify-between mb-2">
						<h3 className="font-semibold">
							{selectedArrondissement}e Arrondissement Events
						</h3>
						<button
							onClick={() => setSelectedArrondissement(null)}
							className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
						>
							✕
						</button>
					</div>
					<div className="space-y-2 max-h-40 overflow-y-auto">
						{getEventsInArrondissement(selectedArrondissement).map((event) => (
							<button
								key={event.id}
								className={`w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary relative ${
									event.isOOOCPick
										? "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 border border-yellow-200 dark:border-yellow-800"
										: "bg-gray-50 dark:bg-gray-700"
								}`}
								onClick={() => onEventClick(event)}
							>
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<div className="flex items-center space-x-1">
											<p className="font-medium text-sm">{event.name}</p>
											{event.isOOOCPick && (
												<Star className="h-3 w-3 text-yellow-500 fill-current" />
											)}
										</div>
										<p className="text-xs text-gray-600 dark:text-gray-400">
											{event.time} • {event.day}
										</p>
										<div className="flex items-center space-x-1 mt-1">
											<Euro className="h-3 w-3 text-gray-400" />
											<span
												className={`text-xs ${
													formatPrice(event.price) === "Free"
														? "text-green-600 dark:text-green-400 font-medium"
														: "text-gray-500 dark:text-gray-400"
												}`}
											>
												{formatPrice(event.price)}
											</span>
										</div>
									</div>
									{event.isOOOCPick && (
										<span className="text-yellow-500 text-xs">🌟</span>
									)}
								</div>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default ParisMapLibre;
