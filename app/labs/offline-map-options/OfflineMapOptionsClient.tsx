"use client";

import arrondissementData from "@/data/paris-arr-v2.json";
import { cn } from "@/lib/utils";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

type Point = [number, number];
type MapOption = {
	id: string;
	title: string;
	kicker: string;
	description: string;
	bestFor: string;
	tradeoff: string;
};

type ParisFeature = {
	type: "Feature";
	geometry: {
		type: "Polygon";
		coordinates: Point[][];
	} | null;
	properties: {
		c_ar: number;
		l_ar: string;
	};
};

const MAP_OPTIONS: MapOption[] = [
	{
		id: "image",
		kicker: "Current preview",
		title: "High-res image fallback",
		description:
			"A single exported image can be made much sharper than today's preview, but labels and roads are baked into pixels.",
		bestFor: "Smallest implementation",
		tradeoff: "Limited zoom and interaction",
	},
	{
		id: "vector",
		kicker: "Designed fallback",
		title: "Offline vector map",
		description:
			"Local GeoJSON draws Paris, the Seine, parks, roads, arrondissements, and event pins. Crisp at every size.",
		bestFor: "Custom offline experience",
		tradeoff: "Less like a real street map unless you bundle more detail",
	},
	{
		id: "raster",
		kicker: "Closest to live map",
		title: "Offline raster tiles",
		description:
			"Pre-generated Paris tiles can use the same visual style as the live map, then your event overlays sit on top.",
		bestFor: "Closest visual match",
		tradeoff: "Largest asset budget",
	},
];

const PARIS_BOUNDS = {
	minLng: 2.224,
	maxLng: 2.47,
	minLat: 48.815,
	maxLat: 48.902,
};

const SAMPLE_EVENTS = [
	{ name: "La Place", lng: 2.343, lat: 48.862, tone: "featured" },
	{ name: "Champ de Mars", lng: 2.298, lat: 48.856, tone: "regular" },
	{ name: "Belleville", lng: 2.383, lat: 48.872, tone: "oooc" },
	{ name: "Wanderlust", lng: 2.373, lat: 48.839, tone: "regular" },
	{ name: "Pigalle", lng: 2.337, lat: 48.883, tone: "featured" },
	{ name: "Bastille", lng: 2.369, lat: 48.853, tone: "regular" },
] as const;

const PARKS = [
	[
		[2.25, 48.845],
		[2.27, 48.842],
		[2.284, 48.851],
		[2.276, 48.864],
		[2.25, 48.86],
	],
	[
		[2.395, 48.835],
		[2.431, 48.833],
		[2.447, 48.85],
		[2.425, 48.863],
		[2.397, 48.856],
	],
] as const;

const ROAD_LINES = [
	[
		[2.285, 48.873],
		[2.318, 48.866],
		[2.352, 48.861],
		[2.384, 48.856],
		[2.424, 48.849],
	],
	[
		[2.302, 48.834],
		[2.33, 48.849],
		[2.36, 48.869],
		[2.387, 48.889],
	],
	[
		[2.265, 48.86],
		[2.307, 48.857],
		[2.352, 48.854],
		[2.407, 48.852],
	],
] as const;

const SEINE = [
	[2.255, 48.847],
	[2.285, 48.852],
	[2.315, 48.858],
	[2.345, 48.858],
	[2.37, 48.852],
	[2.395, 48.846],
	[2.43, 48.841],
] as const;

const PROJECT_WIDTH = 1000;
const PROJECT_HEIGHT = 650;
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const features = (
	arrondissementData as unknown as { features: ParisFeature[] }
).features.filter((feature) => feature.geometry);

const project = ([lng, lat]: readonly [number, number]): Point => {
	const x =
		((lng - PARIS_BOUNDS.minLng) /
			(PARIS_BOUNDS.maxLng - PARIS_BOUNDS.minLng)) *
		PROJECT_WIDTH;
	const y =
		(1 -
			(lat - PARIS_BOUNDS.minLat) /
				(PARIS_BOUNDS.maxLat - PARIS_BOUNDS.minLat)) *
		PROJECT_HEIGHT;
	return [x, y];
};

const pathForRing = (ring: readonly (readonly [number, number])[]) =>
	ring
		.map((coordinate, index) => {
			const [x, y] = project(coordinate);
			return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(" ")
		.concat(" Z");

const pathForLine = (line: readonly (readonly [number, number])[]) =>
	line
		.map((coordinate, index) => {
			const [x, y] = project(coordinate);
			return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(" ");

function ComparisonHeader() {
	return (
		<div className="mb-5 max-w-3xl">
			<p className="text-sm leading-relaxed text-muted-foreground">
				These are direction prototypes, not final assets. The raster-tile panel
				uses the live style as a stand-in for tiles we would pre-generate and
				ship/cache for Paris.
			</p>
		</div>
	);
}

function OptionShell({
	option,
	children,
}: {
	option: MapOption;
	children: React.ReactNode;
}) {
	return (
		<section className="overflow-hidden rounded-lg border border-border/75 bg-card/86 shadow-[0_18px_42px_-34px_rgba(16,12,9,0.58)]">
			<div className="border-b border-border/65 px-4 py-3">
				<p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
					{option.kicker}
				</p>
				<h2 className="mt-0.5 text-xl [font-family:var(--ooo-font-display)] font-light">
					{option.title}
				</h2>
				<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
					{option.description}
				</p>
			</div>
			<div className="p-3">{children}</div>
			<div className="grid gap-2 border-t border-border/65 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2">
				<p>
					<span className="font-medium text-foreground">Best for:</span>{" "}
					{option.bestFor}
				</p>
				<p>
					<span className="font-medium text-foreground">Tradeoff:</span>{" "}
					{option.tradeoff}
				</p>
			</div>
		</section>
	);
}

function ImageFallbackPreview() {
	return (
		<div className="relative h-[30rem] overflow-hidden rounded-lg border border-border/70 bg-background">
			<div
				className="absolute inset-0 bg-cover bg-center"
				style={{ backgroundImage: "url('/maps/paris-map-preview.jpg')" }}
			/>
			<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(30,23,18,0.18))]" />
			{SAMPLE_EVENTS.map((event) => {
				const [x, y] = project([event.lng, event.lat]);
				return (
					<div
						key={event.name}
						className={cn(
							"absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_3px_8px_rgba(0,0,0,0.28)]",
							event.tone === "featured"
								? "bg-[#d8a241]"
								: event.tone === "oooc"
									? "bg-[#2f8f8a]"
									: "bg-[#49382e]",
						)}
						style={{
							left: `${(x / PROJECT_WIDTH) * 100}%`,
							top: `${(y / PROJECT_HEIGHT) * 100}%`,
						}}
						title={event.name}
					/>
				);
			})}
			<div className="absolute bottom-3 left-3 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
				Sharp only at exported sizes
			</div>
		</div>
	);
}

function VectorFallbackPreview() {
	const paths = useMemo(
		() =>
			features.map((feature) => ({
				id: feature.properties.c_ar,
				label: feature.properties.l_ar,
				path: pathForRing(feature.geometry?.coordinates[0] ?? []),
			})),
		[],
	);

	return (
		<div className="relative h-[30rem] overflow-hidden rounded-lg border border-border/70 bg-[#f4efe6]">
			<svg
				viewBox={`0 0 ${PROJECT_WIDTH} ${PROJECT_HEIGHT}`}
				className="h-full w-full"
				role="img"
				aria-label="Designed offline vector map of Paris"
			>
				<defs>
					<filter id="pin-shadow" x="-40%" y="-40%" width="180%" height="180%">
						<feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.28" />
					</filter>
				</defs>
				<rect width={PROJECT_WIDTH} height={PROJECT_HEIGHT} fill="#f4efe6" />
				{PARKS.map((park, index) => (
					<path
						key={`park-${index}`}
						d={pathForRing(park)}
						fill="#cfe0c2"
						opacity="0.88"
					/>
				))}
				<path
					d={pathForLine(SEINE)}
					fill="none"
					stroke="#93bfce"
					strokeLinecap="round"
					strokeWidth="42"
				/>
				<path
					d={pathForLine(SEINE)}
					fill="none"
					stroke="#d9eef4"
					strokeLinecap="round"
					strokeWidth="24"
				/>
				{paths.map((feature) => (
					<path
						key={feature.id}
						d={feature.path}
						fill={feature.id % 2 === 0 ? "#efe4d4" : "#eadccb"}
						opacity="0.72"
						stroke="#a49079"
						strokeWidth="1.6"
					/>
				))}
				{ROAD_LINES.map((road, index) => (
					<path
						key={`road-${index}`}
						d={pathForLine(road)}
						fill="none"
						stroke="#fffaf2"
						strokeLinecap="round"
						strokeWidth={index === 0 ? "8" : "5"}
					/>
				))}
				{paths
					.filter((feature) => [1, 3, 7, 9, 11, 18, 20].includes(feature.id))
					.map((feature) => {
						const source = features.find(
							(item) => item.properties.c_ar === feature.id,
						);
						const center = source?.geometry?.coordinates[0]?.[0] ?? [
							2.35, 48.86,
						];
						const [x, y] = project(center);
						return (
							<text
								key={`label-${feature.id}`}
								x={x}
								y={y}
								fill="#78644f"
								fontSize="18"
								fontWeight="600"
								textAnchor="middle"
								opacity="0.72"
							>
								{feature.id}e
							</text>
						);
					})}
				{SAMPLE_EVENTS.map((event) => {
					const [x, y] = project([event.lng, event.lat]);
					return (
						<g key={event.name} filter="url(#pin-shadow)">
							<circle
								cx={x}
								cy={y}
								r={event.tone === "featured" ? 13 : 10}
								fill={
									event.tone === "featured"
										? "#d8a241"
										: event.tone === "oooc"
											? "#2f8f8a"
											: "#49382e"
								}
								stroke="#fffaf2"
								strokeWidth="4"
							/>
						</g>
					);
				})}
			</svg>
			<div className="absolute bottom-3 left-3 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
				Crisp, local, intentionally simplified
			</div>
		</div>
	);
}

function RasterTilePreview() {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<maplibregl.Map | null>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || mapRef.current) return;

		const map = new maplibregl.Map({
			container,
			style: MAP_STYLE_URL,
			center: [2.3522, 48.8566],
			zoom: 11.15,
			interactive: false,
			attributionControl: false,
		});
		mapRef.current = map;

		map.on("style.load", () => {
			setStatus("ready");
			if (!map.getSource("admin-boundaries")) {
				map.addSource("admin-boundaries", {
					type: "geojson",
					data: arrondissementData as GeoJSON.FeatureCollection,
				});
			}
			if (!map.getLayer("admin-fill")) {
				map.addLayer({
					id: "admin-fill",
					type: "fill",
					source: "admin-boundaries",
					paint: {
						"fill-color": "#d8a241",
						"fill-opacity": 0.12,
					},
				});
			}
			if (!map.getLayer("admin-line")) {
				map.addLayer({
					id: "admin-line",
					type: "line",
					source: "admin-boundaries",
					paint: {
						"line-color": "#49382e",
						"line-opacity": 0.52,
						"line-width": 1.6,
					},
				});
			}
			if (!map.getSource("events")) {
				map.addSource("events", {
					type: "geojson",
					data: {
						type: "FeatureCollection",
						features: SAMPLE_EVENTS.map((event) => ({
							type: "Feature",
							geometry: {
								type: "Point",
								coordinates: [event.lng, event.lat],
							},
							properties: {
								tone: event.tone,
							},
						})),
					},
				});
			}
			if (!map.getLayer("event-pins")) {
				map.addLayer({
					id: "event-pins",
					type: "circle",
					source: "events",
					paint: {
						"circle-radius": [
							"case",
							["==", ["get", "tone"], "featured"],
							8,
							6,
						],
						"circle-color": [
							"case",
							["==", ["get", "tone"], "featured"],
							"#d8a241",
							["==", ["get", "tone"], "oooc"],
							"#2f8f8a",
							"#49382e",
						],
						"circle-stroke-color": "#fffaf2",
						"circle-stroke-width": 2.5,
					},
				});
			}
		});
		map.on("error", () => setStatus("error"));

		return () => {
			mapRef.current = null;
			map.remove();
		};
	}, []);

	return (
		<div className="relative h-[30rem] overflow-hidden rounded-lg border border-border/70 bg-background">
			<div ref={containerRef} className="absolute inset-0" />
			{status === "loading" && (
				<div className="absolute inset-0 flex items-center justify-center bg-background/65 text-sm text-muted-foreground backdrop-blur-sm">
					Loading live style preview...
				</div>
			)}
			{status === "error" && (
				<div className="absolute inset-0 flex items-center justify-center bg-background/75 px-4 text-center text-sm text-muted-foreground">
					Live style unavailable. Offline tiles would render from bundled local
					assets.
				</div>
			)}
			<div className="absolute bottom-3 left-3 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
				Closest to live map if tiles are pre-generated
			</div>
		</div>
	);
}

export function OfflineMapOptionsClient() {
	return (
		<>
			<ComparisonHeader />
			<div className="grid gap-5 xl:grid-cols-3">
				<OptionShell option={MAP_OPTIONS[0]}>
					<ImageFallbackPreview />
				</OptionShell>
				<OptionShell option={MAP_OPTIONS[1]}>
					<VectorFallbackPreview />
				</OptionShell>
				<OptionShell option={MAP_OPTIONS[2]}>
					<RasterTilePreview />
				</OptionShell>
			</div>
		</>
	);
}
