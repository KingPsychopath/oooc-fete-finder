"use client";

import { useOnlineStatus } from "@/components/offline-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@/features/events/types";
import { LAYERS } from "@/lib/ui/layers";
import { ChevronDown, LocateFixed, MapPin, Maximize2 } from "lucide-react";
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
	hasActiveFilters = false,
	activeFiltersCount = 0,
}: EventsMapCardProps) {
	const isOnline = useOnlineStatus();
	const [hasMountedMap, setHasMountedMap] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showNearMeNotice, setShowNearMeNotice] = useState(false);
	const [mapPortalElement, setMapPortalElement] =
		useState<HTMLDivElement | null>(null);
	const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
	const hasFullscreenHistoryEntryRef = useRef(false);
	const nearMeNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const normalMapSlotRef = useRef<HTMLDivElement>(null);
	const fullscreenMapSlotRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = document.createElement("div");
		element.className = "h-full w-full";
		setMapPortalElement(element);

		return () => {
			element.remove();
			if (nearMeNoticeTimeoutRef.current) {
				clearTimeout(nearMeNoticeTimeoutRef.current);
			}
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

	const shouldRenderMap = hasMountedMap || isExpanded || isFullscreen;
	const mapResizeSignal =
		(isExpanded ? 1 : 0) + (isFullscreen ? 2 : 0) + (shouldRenderMap ? 4 : 0);

	const handleOpenFullscreen = () => {
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

	const handleNearMeClick = () => {
		setShowNearMeNotice(true);
		if (nearMeNoticeTimeoutRef.current) {
			clearTimeout(nearMeNoticeTimeoutRef.current);
		}
		nearMeNoticeTimeoutRef.current = setTimeout(() => {
			setShowNearMeNotice(false);
		}, 3600);
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
			className={isFullscreen ? "h-[100svh] rounded-none border-0" : undefined}
		/>
	);

	return (
		<>
			<Card className="ooo-site-card py-0">
				<CardHeader className="border-b border-border/70 py-5 pb-4">
					<div className="space-y-4 sm:space-y-3">
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center space-x-2 flex-wrap">
								<div className="flex items-center space-x-2">
									<MapPin className="h-5 w-5 flex-shrink-0" />
									<span className="text-lg [font-family:var(--ooo-font-display)] font-light sm:text-2xl">
										Paris Event Map
									</span>
								</div>
								<div className="flex items-center space-x-1 mt-1 sm:mt-0">
									<Badge variant="secondary" className="text-xs">
										{events.length} event{events.length !== 1 ? "s" : ""}
									</Badge>
									<Badge
										variant="outline"
										className="border-border/70 bg-background/52 text-xs"
									>
										MapLibre
									</Badge>
									{!isOnline && (
										<Badge
											variant="outline"
											className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs"
										>
											Offline: tiles unavailable
										</Badge>
									)}
								</div>
							</CardTitle>
							<Button
								variant="ghost"
								size="sm"
								onClick={onToggleExpanded}
								className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/65 p-0 text-muted-foreground hover:bg-accent hover:text-foreground sm:h-9 sm:w-auto sm:px-3"
								aria-expanded={isExpanded}
								aria-label={
									isExpanded
										? "Collapse Paris event map"
										: "Expand Paris event map"
								}
							>
								<ChevronDown
									className={`h-3.5 w-3.5 transition-transform transition-bouncy sm:h-4 sm:w-4 sm:mr-1 ${isExpanded ? "rotate-180" : "rotate-0"}`}
								/>
								<span className="text-sm hidden sm:inline">
									{isExpanded ? "Collapse" : "Expand"}
								</span>
							</Button>
						</div>

						<div className="flex flex-wrap justify-center gap-2 sm:justify-end">
							<div className="relative flex items-center space-x-1.5 rounded-lg border border-border/70 bg-background/65 p-0.5">
								<span className="px-1.5 text-[11px] text-muted-foreground">
									Explore:
								</span>
								<Button
									variant="secondary"
									size="sm"
									onClick={handleNearMeClick}
									className="h-7 px-2.5 text-[11px]"
								>
									<LocateFixed className="mr-1 h-3.5 w-3.5" />
									Near me (soon)
								</Button>
								{showNearMeNotice && (
									<div className="absolute top-[calc(100%+0.5rem)] right-0 z-20 w-56 rounded-xl border border-border/75 bg-popover/96 px-3 py-2 text-left text-xs leading-snug text-popover-foreground shadow-[0_16px_34px_-24px_rgba(16,12,9,0.68)] backdrop-blur-md">
										<p className="font-medium text-foreground">
											Near me is coming soon
										</p>
										<p className="mt-0.5 text-muted-foreground">
											It will map events closest to your location.
										</p>
									</div>
								)}
							</div>
							<Button
								variant="outline"
								size="sm"
								ref={fullscreenButtonRef}
								onPointerDown={handleOpenFullscreenPointerDown}
								onClick={handleOpenFullscreen}
								className="h-8 rounded-full border-border/70 bg-background/65 px-2.5 text-[11px]"
								aria-expanded={isFullscreen}
								aria-label="Open Paris event map full screen"
							>
								<Maximize2 className="mr-1.5 h-3.5 w-3.5" />
								Full screen
							</Button>
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
						className="fixed inset-0 h-[100svh] w-screen overflow-hidden bg-background"
						style={{ zIndex: LAYERS.OVERLAY - 10 }}
						role="dialog"
						aria-modal="true"
						aria-label="Full screen Paris event map"
					>
						<div ref={fullscreenMapSlotRef} className="h-[100svh] w-screen" />
					</div>,
					document.body,
				)}
			{shouldRenderMap &&
				mapPortalElement &&
				createPortal(mapContent, mapPortalElement)}
		</>
	);
}
