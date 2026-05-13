"use client";

import arrondissementData from "@/data/paris-arr-v2.json";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type Point = [number, number];
type MapOption = {
	id: string;
	title: string;
	kicker: string;
	description: string;
	bestFor: string;
	tradeoff: string;
};

type AssetStats = {
	previewImageBytes: number | null;
	arrondissementGeoJsonBytes: number | null;
	previewImageGzipBytes: number | null;
	arrondissementGeoJsonGzipBytes: number | null;
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
		geom_x_y?: {
			lon: number;
			lat: number;
		};
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
const PREVIEW_ZOOM_LEVELS = [1, 1.55, 2.25] as const;
const RASTER_TILE_ZOOMS = [12, 13, 14] as const;
const RASTER_TILE_SIZE = 256;
const RASTER_GRID_TILES = 4;

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

const lngLatToWorldPixel = (lng: number, lat: number, zoom: number): Point => {
	const scale = RASTER_TILE_SIZE * 2 ** zoom;
	const sinLat = Math.sin((lat * Math.PI) / 180);
	const x = ((lng + 180) / 360) * scale;
	const y =
		(0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
	return [x, y];
};

const centroidForRing = (ring: readonly Point[]): Point => {
	let twiceArea = 0;
	let centroidX = 0;
	let centroidY = 0;

	for (let index = 0; index < ring.length; index += 1) {
		const [x0, y0] = ring[index];
		const [x1, y1] = ring[(index + 1) % ring.length];
		const cross = x0 * y1 - x1 * y0;
		twiceArea += cross;
		centroidX += (x0 + x1) * cross;
		centroidY += (y0 + y1) * cross;
	}

	if (Math.abs(twiceArea) < 0.000001) {
		return ring[0] ?? [2.3522, 48.8566];
	}

	return [centroidX / (3 * twiceArea), centroidY / (3 * twiceArea)];
};

const formatBytes = (bytes: number | null) => {
	if (bytes === null) return "Unavailable";
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
	const mb = kb / 1024;
	return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
};

const productionSizeNotes = {
	image:
		"Usually one JPG/WebP: tiny to modest, but quality is fixed per export.",
	vector:
		"Paris outline plus parks/river/roads can stay small; detailed streets raise it quickly.",
	raster:
		"Paris z12-z14 is roughly 120 tiles, often around 5 MB; z12-z15 is more like 17 MB.",
};

function ZoomControls({
	canZoomIn,
	canZoomOut,
	onZoomIn,
	onZoomOut,
}: {
	canZoomIn: boolean;
	canZoomOut: boolean;
	onZoomIn: () => void;
	onZoomOut: () => void;
}) {
	return (
		<div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-lg border border-border/70 bg-card/92 shadow-sm backdrop-blur">
			<button
				type="button"
				className="grid size-9 place-items-center text-lg leading-none transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
				aria-label="Zoom out"
				disabled={!canZoomOut}
				onClick={onZoomOut}
			>
				-
			</button>
			<button
				type="button"
				className="grid size-9 place-items-center border-l border-border/70 text-lg leading-none transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
				aria-label="Zoom in"
				disabled={!canZoomIn}
				onClick={onZoomIn}
			>
				+
			</button>
		</div>
	);
}

function usePreviewZoom() {
	const [zoomIndex, setZoomIndex] = useState(0);
	return {
		zoom: PREVIEW_ZOOM_LEVELS[zoomIndex],
		canZoomIn: zoomIndex < PREVIEW_ZOOM_LEVELS.length - 1,
		canZoomOut: zoomIndex > 0,
		zoomIn: () =>
			setZoomIndex((current) =>
				Math.min(current + 1, PREVIEW_ZOOM_LEVELS.length - 1),
			),
		zoomOut: () => setZoomIndex((current) => Math.max(current - 1, 0)),
	};
}

function ComparisonHeader() {
	return (
		<div className="mb-5 max-w-3xl">
			<p className="text-sm leading-relaxed text-muted-foreground">
				These are direction prototypes, not final assets. The raster panel uses
				live raster map tiles as a visual stand-in; real offline tiles would be
				pre-generated, bundled, and cached for Paris.
			</p>
		</div>
	);
}

function OptionShell({
	option,
	sizeLabel,
	productionNote,
	children,
}: {
	option: MapOption;
	sizeLabel: string;
	productionNote: string;
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
				<p>
					<span className="font-medium text-foreground">Prototype size:</span>{" "}
					{sizeLabel}
				</p>
				<p>
					<span className="font-medium text-foreground">Production size:</span>{" "}
					{productionNote}
				</p>
			</div>
		</section>
	);
}

function ImageFallbackPreview() {
	const { zoom, canZoomIn, canZoomOut, zoomIn, zoomOut } = usePreviewZoom();

	return (
		<div className="relative h-[30rem] overflow-hidden rounded-lg border border-border/70 bg-background">
			<ZoomControls
				canZoomIn={canZoomIn}
				canZoomOut={canZoomOut}
				onZoomIn={zoomIn}
				onZoomOut={zoomOut}
			/>
			<div
				className="absolute inset-0 origin-center transition-transform duration-300 ease-out"
				style={{ transform: `scale(${zoom})` }}
			>
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
			</div>
			<div className="absolute bottom-3 left-3 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
				Sharp only at exported sizes
			</div>
		</div>
	);
}

function VectorFallbackPreview() {
	const { zoom, canZoomIn, canZoomOut, zoomIn, zoomOut } = usePreviewZoom();
	const paths = useMemo(
		() =>
			features.map((feature) => ({
				id: feature.properties.c_ar,
				label: feature.properties.l_ar,
				path: pathForRing(feature.geometry?.coordinates[0] ?? []),
				center: feature.properties.geom_x_y
					? ([
							feature.properties.geom_x_y.lon,
							feature.properties.geom_x_y.lat,
						] as Point)
					: centroidForRing(feature.geometry?.coordinates[0] ?? []),
			})),
		[],
	);

	return (
		<div className="relative h-[30rem] overflow-hidden rounded-lg border border-border/70 bg-[#f4efe6]">
			<ZoomControls
				canZoomIn={canZoomIn}
				canZoomOut={canZoomOut}
				onZoomIn={zoomIn}
				onZoomOut={zoomOut}
			/>
			<svg
				viewBox={`0 0 ${PROJECT_WIDTH} ${PROJECT_HEIGHT}`}
				className="h-full w-full origin-center transition-transform duration-300 ease-out"
				role="img"
				aria-label="Designed offline vector map of Paris"
				style={{ transform: `scale(${zoom})` }}
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
				{paths.map((feature) => {
					const [x, y] = project(feature.center);
					return (
						<text
							key={`label-${feature.id}`}
							x={x}
							y={y}
							fill="#75614c"
							fontSize="13"
							fontWeight="600"
							opacity="0.48"
							paintOrder="stroke"
							stroke="#f4efe6"
							strokeWidth="7"
							textAnchor="middle"
						>
							{feature.id}
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
	const [zoomIndex, setZoomIndex] = useState(0);
	const zoom = RASTER_TILE_ZOOMS[zoomIndex];
	const canZoomIn = zoomIndex < RASTER_TILE_ZOOMS.length - 1;
	const canZoomOut = zoomIndex > 0;
	const zoomIn = () =>
		setZoomIndex((current) =>
			Math.min(current + 1, RASTER_TILE_ZOOMS.length - 1),
		);
	const zoomOut = () => setZoomIndex((current) => Math.max(current - 1, 0));
	const tileLayout = useMemo(() => {
		const [centerX, centerY] = lngLatToWorldPixel(2.3522, 48.8566, zoom);
		const startTileX = Math.floor(centerX / RASTER_TILE_SIZE) - 1;
		const startTileY = Math.floor(centerY / RASTER_TILE_SIZE) - 1;
		const topLeftX = startTileX * RASTER_TILE_SIZE;
		const topLeftY = startTileY * RASTER_TILE_SIZE;
		const tiles = Array.from({ length: RASTER_GRID_TILES ** 2 }, (_, index) => {
			const column = index % RASTER_GRID_TILES;
			const row = Math.floor(index / RASTER_GRID_TILES);
			return {
				id: `${zoom}-${startTileX + column}-${startTileY + row}`,
				x: startTileX + column,
				y: startTileY + row,
				left: column * RASTER_TILE_SIZE,
				top: row * RASTER_TILE_SIZE,
			};
		});
		return { tiles, topLeftX, topLeftY };
	}, [zoom]);

	return (
		<div className="relative h-[30rem] overflow-hidden rounded-lg border border-border/70 bg-background">
			<ZoomControls
				canZoomIn={canZoomIn}
				canZoomOut={canZoomOut}
				onZoomIn={zoomIn}
				onZoomOut={zoomOut}
			/>
			<div className="absolute inset-0 bg-[#eef0eb]" />
			<div className="absolute left-1/2 top-1/2 size-[1024px] -translate-x-1/2 -translate-y-1/2">
				{tileLayout.tiles.map((tile) => (
					<img
						key={tile.id}
						src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
						alt=""
						className="absolute size-64 select-none"
						draggable={false}
						style={{
							left: tile.left,
							top: tile.top,
						}}
					/>
				))}
				<div className="absolute inset-0 bg-[linear-gradient(rgba(73,56,46,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(73,56,46,0.12)_1px,transparent_1px)] bg-[length:256px_256px]" />
				{SAMPLE_EVENTS.map((event) => {
					const [x, y] = lngLatToWorldPixel(event.lng, event.lat, zoom);
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
								left: x - tileLayout.topLeftX,
								top: y - tileLayout.topLeftY,
							}}
							title={event.name}
						/>
					);
				})}
				<div className="absolute right-4 top-16 rounded-md border border-white/65 bg-white/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[#49382e] shadow-sm">
					z{zoom} tile set
				</div>
			</div>
			<div className="absolute bottom-3 left-3 rounded-full border border-border/70 bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
				Live tile stand-in for bundled offline tiles
			</div>
		</div>
	);
}

function ComparisonMatrix({ assetStats }: { assetStats: AssetStats }) {
	const rows = [
		{
			label: "Current prototype asset",
			image: formatBytes(assetStats.previewImageBytes),
			vector: formatBytes(assetStats.arrondissementGeoJsonBytes),
			raster: "0 bundled; live tile stand-in",
		},
		{
			label: "Approx compressed transfer",
			image: formatBytes(assetStats.previewImageGzipBytes),
			vector: formatBytes(assetStats.arrondissementGeoJsonGzipBytes),
			raster: "N/A until tiles are generated",
		},
		{
			label: "Production offline asset",
			image: "One image export",
			vector: "Needs real streets/parks dataset",
			raster: "Paris tile pyramid, MB-scale",
		},
		{
			label: "Zoom behavior",
			image: "Zooms into one bitmap",
			vector: "Stays crisp",
			raster: "Swaps sharper tiles per zoom",
		},
		{
			label: "Closest to live map",
			image: "Medium",
			vector: "Low to medium",
			raster: "Highest",
		},
		{
			label: "Offline complexity",
			image: "Lowest",
			vector: "Medium",
			raster: "Highest",
		},
	];

	return (
		<section className="mt-5 overflow-hidden rounded-lg border border-border/75 bg-card/86">
			<div className="border-b border-border/65 px-4 py-3">
				<h2 className="text-lg [font-family:var(--ooo-font-display)] font-light">
					What To Compare
				</h2>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[760px] text-left text-sm">
					<thead className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
						<tr className="border-b border-border/60">
							<th className="px-4 py-3 font-medium">Measure</th>
							<th className="px-4 py-3 font-medium">Image</th>
							<th className="px-4 py-3 font-medium">Vector</th>
							<th className="px-4 py-3 font-medium">Raster Tiles</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border/55">
						{rows.map((row) => (
							<tr key={row.label}>
								<th className="px-4 py-3 font-medium text-foreground">
									{row.label}
								</th>
								<td className="px-4 py-3 text-muted-foreground">{row.image}</td>
								<td className="px-4 py-3 text-muted-foreground">
									{row.vector}
								</td>
								<td className="px-4 py-3 text-muted-foreground">
									{row.raster}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export function OfflineMapOptionsClient({
	assetStats,
}: {
	assetStats: AssetStats;
}) {
	return (
		<>
			<ComparisonHeader />
			<div className="grid gap-5 xl:grid-cols-3">
				<OptionShell
					option={MAP_OPTIONS[0]}
					sizeLabel={formatBytes(assetStats.previewImageBytes)}
					productionNote={productionSizeNotes.image}
				>
					<ImageFallbackPreview />
				</OptionShell>
				<OptionShell
					option={MAP_OPTIONS[1]}
					sizeLabel={formatBytes(assetStats.arrondissementGeoJsonBytes)}
					productionNote={productionSizeNotes.vector}
				>
					<VectorFallbackPreview />
				</OptionShell>
				<OptionShell
					option={MAP_OPTIONS[2]}
					sizeLabel="0 bundled; live tile stand-in"
					productionNote={productionSizeNotes.raster}
				>
					<RasterTilePreview />
				</OptionShell>
			</div>
			<ComparisonMatrix assetStats={assetStats} />
		</>
	);
}
