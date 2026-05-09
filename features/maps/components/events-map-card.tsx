"use client";

import { useOnlineStatus } from "@/components/offline-indicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	panelActionButtonClassName,
	panelActionIconClassName,
} from "@/features/events/components/filter-action-button-styles";
import type { Event } from "@/features/events/types";
import { LAYERS } from "@/lib/ui/layers";
import { cn } from "@/lib/utils";
import { ChevronDown, MapPin, Maximize2 } from "lucide-react";
import dynamic from "next/dynamic";
import {
	type PointerEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

const ParisMapLibre = dynamic(
	() => import("@/features/maps/components/ParisMapLibre"),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full items-center justify-center bg-background/50 px-4 text-center">
				<p className="text-xs text-muted-foreground sm:text-sm">
					Loading interactive map…
				</p>
			</div>
		),
	},
);

export type MapLoadStrategy = "immediate" | "expand" | "idle";

type EventsMapCardProps = {
	events: Event[];
	isExpanded: boolean;
	onToggleExpanded: () => void;
	onEventClick: (event: Event) => void;
	mapLoadStrategy?: MapLoadStrategy;
	onFilterClick?: () => void;
	onMapIntent?: () => void;
	hasActiveFilters?: boolean;
	activeFiltersCount?: number;
};

export function EventsMapCard({
	events,
	isExpanded,
	onToggleExpanded,
	onEventClick,
	mapLoadStrategy = "idle",
	onFilterClick,
	onMapIntent,
	hasActiveFilters = false,
	activeFiltersCount = 0,
}: EventsMapCardProps) {
	const isOnline = useOnlineStatus();
	const [hasMountedMap, setHasMountedMap] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [shouldOpenFullscreenAfterMount, setShouldOpenFullscreenAfterMount] =
		useState(false);
	const [mapPortalElement, setMapPortalElement] =
		useState<HTMLDivElement | null>(null);
	const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
	const hasFullscreenHistoryEntryRef = useRef(false);
	const normalMapSlotRef = useRef<HTMLDivElement>(null);
	const fullscreenMapSlotRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = document.createElement("div");
		element.className = "h-full w-full";
		setMapPortalElement(element);

		return () => {
			element.remove();
		};
	}, []);

	useEffect(() => {
		if (hasMountedMap) return;

		if (mapLoadStrategy === "immediate") {
			setHasMountedMap(true);
			return;
		}

		if (mapLoadStrategy === "expand") {
			if (isExpanded) {
				setHasMountedMap(true);
			}
			return;
		}

		if (isExpanded) {
			setHasMountedMap(true);
			return;
		}

		let cancelled = false;
		let idleId: number | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const mountPreview = () => {
			if (!cancelled) {
				setHasMountedMap(true);
			}
		};

		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			idleId = window.requestIdleCallback(mountPreview, { timeout: 1200 });
		} else {
			timeoutId = setTimeout(mountPreview, 700);
		}

		return () => {
			cancelled = true;
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
	}, [isExpanded, hasMountedMap, mapLoadStrategy]);

	useEffect(() => {
		if (!isFullscreen) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		window.history.pushState(
			{ ...(window.history.state ?? {}), ooocMapFullscreen: true },
			"",
		);
		hasFullscreenHistoryEntryRef.current = true;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsFullscreen(false);
			}
		};
		const handlePopState = (event: PopStateEvent) => {
			const nextState =
				event.state &&
				typeof event.state === "object" &&
				!Array.isArray(event.state)
					? (event.state as Record<string, unknown>)
					: {};
			if (
				hasFullscreenHistoryEntryRef.current &&
				nextState.ooocMapFullscreen !== true
			) {
				hasFullscreenHistoryEntryRef.current = false;
				setIsFullscreen(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("popstate", handlePopState);

		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("popstate", handlePopState);
			if (hasFullscreenHistoryEntryRef.current) {
				hasFullscreenHistoryEntryRef.current = false;
				window.history.back();
			}
			window.requestAnimationFrame(() => {
				fullscreenButtonRef.current?.focus();
			});
		};
	}, [isFullscreen]);

	useLayoutEffect(() => {
		const normalMapSlot = normalMapSlotRef.current;
		const fullscreenMapSlot = fullscreenMapSlotRef.current;

		if (!mapPortalElement || !normalMapSlot) return;

		if (isFullscreen && fullscreenMapSlot) {
			fullscreenMapSlot.appendChild(mapPortalElement);
			return () => {
				normalMapSlot.appendChild(mapPortalElement);
			};
		}

		if (mapPortalElement.parentElement !== normalMapSlot) {
			normalMapSlot.appendChild(mapPortalElement);
		}
	}, [isFullscreen, mapPortalElement]);

	useEffect(() => {
		if (!shouldOpenFullscreenAfterMount || !hasMountedMap || !mapPortalElement) {
			return;
		}

		let frameId: number | null = null;
		frameId = window.requestAnimationFrame(() => {
			setIsFullscreen(true);
			setShouldOpenFullscreenAfterMount(false);
		});

		return () => {
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
		};
	}, [hasMountedMap, mapPortalElement, shouldOpenFullscreenAfterMount]);

	const shouldRenderMap = hasMountedMap || isExpanded || isFullscreen;
	const mapResizeSignal =
		(isExpanded ? 1 : 0) + (isFullscreen ? 2 : 0) + (shouldRenderMap ? 4 : 0);
	const mapHeaderActionButtonClassName = cn(
		panelActionButtonClassName,
		"w-11 whitespace-nowrap px-0 md:w-[8.5rem] md:px-3",
	);
	const mapHeaderActionIconClassName = cn(
		panelActionIconClassName,
		"mr-0 md:mr-1",
	);
	const mapHeaderActionLabelClassName = "sr-only text-sm md:not-sr-only";

	const handleOpenFullscreen = () => {
		onMapIntent?.();
		if (!hasMountedMap) {
			setHasMountedMap(true);
			setShouldOpenFullscreenAfterMount(true);
			return;
		}
		setHasMountedMap(true);
		setIsFullscreen(true);
	};

	const handleOpenFullscreenPointerDown = (
		event: PointerEvent<HTMLButtonElement>,
	) => {
		event.preventDefault();
		event.stopPropagation();
		handleOpenFullscreen();
	};

	const handleToggleFullscreen = () => {
		if (isFullscreen) {
			setIsFullscreen(false);
			return;
		}
		handleOpenFullscreen();
	};

	const mapContent = (
		<ParisMapLibre
			events={events}
			onEventClick={onEventClick}
			resizeSignal={mapResizeSignal}
			onFullscreenRequest={handleToggleFullscreen}
			isFullscreen={isFullscreen}
			onFilterClick={onFilterClick}
			hasActiveFilters={hasActiveFilters}
			activeFiltersCount={activeFiltersCount}
			className={isFullscreen ? "h-[100dvh] rounded-none border-0" : undefined}
		/>
	);

	return (
		<>
			<Card className="ooo-site-card py-0">
				<CardHeader className="border-b border-border/70 py-5 pb-4">
					<div className="flex flex-col gap-4">
						<div className="flex items-start justify-between gap-3">
							<CardTitle className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
								<div className="flex items-center gap-2">
									<MapPin
										className="h-5.5 w-5.5 flex-shrink-0 text-muted-foreground/75"
										strokeWidth={1.6}
									/>
									<span className="text-lg [font-family:var(--ooo-font-display)] font-light sm:text-2xl">
										Paris Event Map
									</span>
								</div>
								{!isOnline && (
									<span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">
										Offline: tiles unavailable
									</span>
								)}
							</CardTitle>
							<div className="flex shrink-0 items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									ref={fullscreenButtonRef}
									onPointerDown={handleOpenFullscreenPointerDown}
									onClick={handleOpenFullscreen}
									className={mapHeaderActionButtonClassName}
									aria-expanded={isFullscreen}
									aria-label="Open Paris event map full screen"
								>
									<Maximize2 className={mapHeaderActionIconClassName} />
									<span className={mapHeaderActionLabelClassName}>Full screen</span>
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={onToggleExpanded}
									className={mapHeaderActionButtonClassName}
									aria-expanded={isExpanded}
									aria-label={
										isExpanded
											? "Collapse Paris event map"
											: "Expand Paris event map"
									}
								>
									<ChevronDown
										className={cn(
											mapHeaderActionIconClassName,
											"transition-transform transition-bouncy",
											isExpanded ? "rotate-180" : "rotate-0",
										)}
									/>
									<span className={mapHeaderActionLabelClassName}>
										{isExpanded ? "Collapse" : "Expand"}
									</span>
								</Button>
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-3 py-5 pt-3 sm:px-6">
					<div
						className={`relative contain-layout overflow-hidden rounded-xl border border-border/65 motion-safe:transition-[max-height] motion-safe:duration-300 motion-safe:ease-out motion-safe:will-change-[max-height] ${
							isExpanded ? "max-h-[600px]" : "max-h-24 sm:max-h-32"
						}`}
					>
						<div ref={normalMapSlotRef} className="h-[600px] w-full">
							{!shouldRenderMap && (
								<div className="flex h-full items-center justify-center bg-background/50 px-4 text-center">
									<p className="text-xs text-muted-foreground sm:text-sm">
										Map preview loading quietly. Expand to explore by
										arrondissement.
									</p>
								</div>
							)}
						</div>
						{!isExpanded && (
							<>
								<div className="pointer-events-none absolute inset-x-0 bottom-3 z-[1] flex justify-center px-3">
									<p className="text-[11px] tracking-[0.04em] text-muted-foreground/92">
										Expand to explore the live map by arrondissement
									</p>
								</div>
								<div className="absolute inset-x-0 bottom-0 h-10 sm:h-12 bg-gradient-to-t from-card via-card/70 to-transparent pointer-events-none rounded-b-md" />
							</>
						)}
					</div>
				</CardContent>
			</Card>
			{isFullscreen &&
				createPortal(
					<div
						className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-background"
						style={{ zIndex: LAYERS.OVERLAY - 10 }}
						role="dialog"
						aria-modal="true"
						aria-label="Full screen Paris event map"
					>
						<div ref={fullscreenMapSlotRef} className="h-[100dvh] w-screen" />
					</div>,
					document.body,
				)}
			{shouldRenderMap &&
				mapPortalElement &&
				createPortal(mapContent, mapPortalElement)}
		</>
	);
}
