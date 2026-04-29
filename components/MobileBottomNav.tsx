"use client";

import MusicPlatformModal from "@/components/MusicPlatformModal";
import { Button } from "@/components/ui/button";
import { COMMUNITY_INVITE_CONFIG } from "@/features/social/config";
import { useHasActiveBodyOverlay } from "@/hooks/useHasActiveBodyOverlay";
import { LAYERS } from "@/lib/ui/layers";
import { cn } from "@/lib/utils";
import {
	CalendarDays,
	CircleHelp,
	ExternalLink,
	House,
	Info,
	Map,
	Megaphone,
	Menu,
	MessageCircle,
	Music2,
	Pin,
	PinOff,
	PlusCircle,
	Toilet,
	Utensils,
	X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const SCROLL_HIDE_THRESHOLD = 96;
const PIN_STORAGE_KEY = "oooc_mobile_nav_pinned";
const MOBILE_NAV_VISIBLE_OFFSET = "5.75rem";
const MOBILE_NAV_HIDDEN_OFFSET = "1rem";
const MOBILE_TOP_WITH_NAV_OFFSET = "9.5rem";
const MOBILE_TOP_WITHOUT_NAV_OFFSET = "4.75rem";
const MOBILE_PROMPT_WITH_NAV_OFFSET = "6.25rem";
const MOBILE_PROMPT_WITHOUT_NAV_OFFSET = "1rem";
const ACTIVE_SECTION_LOCK_MS = 2200;
const PENDING_HOME_SECTION_STORAGE_KEY = "oooc_pending_home_section";

const excludedPathPrefixes = [
	"/admin",
	"/event-modal-lab",
	"/header-lab",
	"/home-style-lab",
	"/social",
] as const;

type NavKey = "home" | "map" | "events" | "submit" | "more";

interface NavItem {
	key: NavKey;
	label: string;
	href: string;
	icon: LucideIcon;
	isActive: boolean;
	sectionId?: string;
}

function normalizePathname(pathname: string | null): string {
	const normalized = (pathname || "/").replace(/\/+$/, "") || "/";
	if (basePath && basePath !== "/" && normalized.startsWith(basePath)) {
		return normalized.slice(basePath.length) || "/";
	}
	return normalized;
}

function useMobileNavVisibility(isPinnedOpen: boolean) {
	const [isVisible, setIsVisible] = useState(true);
	const lastYRef = useRef(0);

	useEffect(() => {
		if (isPinnedOpen) {
			setIsVisible(true);
			return;
		}

		lastYRef.current = window.scrollY;
		let rafId: number | null = null;

		const updateVisibility = () => {
			rafId = null;
			const nextY = window.scrollY;
			if (nextY < SCROLL_HIDE_THRESHOLD) {
				setIsVisible(true);
			} else if (nextY > lastYRef.current) {
				setIsVisible(false);
			} else if (nextY < lastYRef.current) {
				setIsVisible(true);
			}

			lastYRef.current = nextY;
		};

		const handleScroll = () => {
			if (rafId === null) {
				rafId = window.requestAnimationFrame(updateVisibility);
			}
		};

		window.addEventListener("scroll", handleScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", handleScroll);
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId);
			}
		};
	}, [isPinnedOpen]);

	return isVisible;
}

function getToiletFinderUrl() {
	if (typeof navigator === "undefined") {
		return "https://apps.apple.com/app/id311896604";
	}

	const userAgent = navigator.userAgent.toLowerCase();
	if (/android/.test(userAgent)) {
		return "https://play.google.com/store/apps/details?id=com.bto.toilet&hl=en_GB";
	}

	return "https://apps.apple.com/app/id311896604";
}

function readPinnedPreference(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(PIN_STORAGE_KEY) === "true";
}

function scrollToHomeSectionWhenReady(
	sectionId: string,
	behavior: ScrollBehavior = "auto",
	attempt = 0,
) {
	const section = document.getElementById(sectionId);
	if (section) {
		section.scrollIntoView({ block: "start", behavior });
		return;
	}

	if (attempt >= 24) return;
	window.setTimeout(() => {
		scrollToHomeSectionWhenReady(sectionId, behavior, attempt + 1);
	}, 50);
}

export function MobileBottomNav() {
	const pathname = usePathname();
	const normalizedPathname = normalizePathname(pathname);
	const [activeSection, setActiveSection] = useState<NavKey | null>(null);
	const [isPinned, setIsPinned] = useState(false);
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
	const [toiletFinderUrl, setToiletFinderUrl] = useState(
		"https://apps.apple.com/app/id311896604",
	);
	const activeSectionLockUntilRef = useRef(0);
	const pendingHomeSectionScrollRef = useRef<string | null>(null);
	const previousPathnameRef = useRef(pathname);
	const shouldScrollToTopOnRouteRef = useRef(false);
	const hasActiveOverlay = useHasActiveBodyOverlay();
	const isVisible = useMobileNavVisibility(
		isPinned || isMoreOpen || isMusicModalOpen,
	);

	useEffect(() => {
		setIsPinned(readPinnedPreference());
	}, []);

	useEffect(() => {
		setToiletFinderUrl(getToiletFinderUrl());
	}, []);

	useEffect(() => {
		if (pathname === null) return;
		setIsMoreOpen(false);

		const pendingStoredSection =
			typeof window === "undefined"
				? null
				: window.sessionStorage.getItem(PENDING_HOME_SECTION_STORAGE_KEY);
		if (pendingStoredSection && normalizePathname(pathname) === "/") {
			pendingHomeSectionScrollRef.current = pendingStoredSection;
			window.sessionStorage.removeItem(PENDING_HOME_SECTION_STORAGE_KEY);
		}

		if (
			pendingHomeSectionScrollRef.current &&
			normalizePathname(pathname) === "/"
		) {
			const sectionId = pendingHomeSectionScrollRef.current;
			pendingHomeSectionScrollRef.current = null;
			setActiveSection(sectionId === "event-map" ? "map" : "events");
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(() => {
					scrollToHomeSectionWhenReady(sectionId, "auto");
				});
			});
		}

		if (
			shouldScrollToTopOnRouteRef.current &&
			previousPathnameRef.current !== pathname
		) {
			shouldScrollToTopOnRouteRef.current = false;
			window.requestAnimationFrame(() => {
				window.scrollTo({ top: 0, behavior: "auto" });
			});
		}

		previousPathnameRef.current = pathname;
	}, [pathname]);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const syncHashActiveSection = () => {
			if (normalizedPathname !== "/") {
				setActiveSection(null);
				return;
			}

			if (window.location.hash === "#event-map") {
				setActiveSection("map");
				return;
			}

			if (window.location.hash === "#all-events") {
				setActiveSection("events");
				return;
			}

			setActiveSection(null);
		};

		syncHashActiveSection();
		window.addEventListener("hashchange", syncHashActiveSection);

		return () => {
			window.removeEventListener("hashchange", syncHashActiveSection);
		};
	}, [normalizedPathname]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (normalizedPathname !== "/") return;

		const sections = [
			{ key: "map" as const, element: document.getElementById("event-map") },
			{
				key: "events" as const,
				element: document.getElementById("all-events"),
			},
		].filter(
			(
				section,
			): section is {
				key: "map" | "events";
				element: HTMLElement;
			} => section.element !== null,
		);

		if (sections.length === 0) return;

		let rafId: number | null = null;

		const syncSectionFromScroll = () => {
			rafId = null;
			if (Date.now() < activeSectionLockUntilRef.current) return;

			const activationOffset = 24;
			const currentY = window.scrollY + activationOffset;
			let nextSection: NavKey | null = null;
			const mapSection = sections.find((section) => section.key === "map");
			const eventsSection = sections.find(
				(section) => section.key === "events",
			);

			if (mapSection && currentY >= mapSection.element.offsetTop) {
				nextSection = "map";
			}

			if (eventsSection && currentY >= eventsSection.element.offsetTop) {
				nextSection = "events";
			}

			setActiveSection(nextSection);
		};

		const onScroll = () => {
			if (rafId === null) {
				rafId = window.requestAnimationFrame(syncSectionFromScroll);
			}
		};

		syncSectionFromScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);

		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId);
			}
		};
	}, [normalizedPathname]);

	const shouldRender = useMemo(() => {
		return !excludedPathPrefixes.some((prefix) => {
			return (
				normalizedPathname === prefix ||
				normalizedPathname.startsWith(`${prefix}/`)
			);
		});
	}, [normalizedPathname]);

	useEffect(() => {
		if (typeof document === "undefined") return;

		const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;
		const root = document.documentElement;
		const shouldReserveNavSpace =
			isMobileViewport && shouldRender && isVisible && !hasActiveOverlay;
		root.style.setProperty(
			"--oooc-mobile-nav-offset",
			shouldReserveNavSpace
				? MOBILE_NAV_VISIBLE_OFFSET
				: MOBILE_NAV_HIDDEN_OFFSET,
		);
		root.style.setProperty(
			"--oooc-mobile-top-offset",
			shouldReserveNavSpace
				? MOBILE_TOP_WITH_NAV_OFFSET
				: MOBILE_TOP_WITHOUT_NAV_OFFSET,
		);
		root.style.setProperty(
			"--oooc-mobile-prompt-offset",
			shouldReserveNavSpace
				? MOBILE_PROMPT_WITH_NAV_OFFSET
				: MOBILE_PROMPT_WITHOUT_NAV_OFFSET,
		);

		return () => {
			root.style.removeProperty("--oooc-mobile-nav-offset");
			root.style.removeProperty("--oooc-mobile-top-offset");
			root.style.removeProperty("--oooc-mobile-prompt-offset");
		};
	}, [hasActiveOverlay, isVisible, shouldRender]);

	if (!shouldRender) {
		return null;
	}

	const navItems: NavItem[] = [
		{
			key: "home",
			label: "Home",
			href: basePath || "/",
			icon: House,
			isActive:
				activeSection === "home" ||
				(normalizedPathname === "/" && activeSection === null),
		},
		{
			key: "map",
			label: "Map",
			href: `${basePath || ""}/#event-map`,
			icon: Map,
			sectionId: "event-map",
			isActive: normalizedPathname === "/" && activeSection === "map",
		},
		{
			key: "events",
			label: "Events",
			href: `${basePath || ""}/#all-events`,
			icon: CalendarDays,
			sectionId: "all-events",
			isActive: normalizedPathname === "/" && activeSection === "events",
		},
		{
			key: "submit",
			label: "Submit",
			href: `${basePath || ""}/submit-event`,
			icon: PlusCircle,
			isActive:
				activeSection === "submit" ||
				normalizedPathname === "/submit-event" ||
				normalizedPathname.startsWith("/submit-event/"),
		},
	];

	const isMoreActive =
		isMoreOpen ||
		normalizedPathname === "/how-it-works" ||
		normalizedPathname.startsWith("/how-it-works/") ||
		normalizedPathname === "/feature-event" ||
		normalizedPathname.startsWith("/feature-event/");
	const activeIndex = navItems.findIndex((item) => item.isActive);
	const resolvedActiveIndex = isMoreActive
		? navItems.length
		: activeIndex >= 0
			? activeIndex
			: -1;

	const handlePinToggle = () => {
		setIsPinned((current) => {
			const next = !current;
			window.localStorage.setItem(PIN_STORAGE_KEY, String(next));
			return next;
		});
	};

	const handleNavItemClick = (key: NavKey, sectionId?: string) => {
		activeSectionLockUntilRef.current = Date.now() + ACTIVE_SECTION_LOCK_MS;
		setActiveSection(key === "home" ? "home" : key);
		setIsMoreOpen(false);

		if (key === "home") {
			shouldScrollToTopOnRouteRef.current = false;
			pendingHomeSectionScrollRef.current = null;
			if (normalizedPathname === "/") {
				window.requestAnimationFrame(() => {
					window.scrollTo({ top: 0, behavior: "smooth" });
				});
				return;
			}
			shouldScrollToTopOnRouteRef.current = true;
			return;
		}

		if (key === "submit") {
			shouldScrollToTopOnRouteRef.current = true;
			pendingHomeSectionScrollRef.current = null;
			return;
		}

		shouldScrollToTopOnRouteRef.current = false;
		pendingHomeSectionScrollRef.current =
			sectionId && normalizedPathname !== "/" ? sectionId : null;
		if (sectionId && normalizedPathname !== "/") {
			window.sessionStorage.setItem(PENDING_HOME_SECTION_STORAGE_KEY, sectionId);
			return;
		}
		if (sectionId) {
			window.requestAnimationFrame(() => {
				scrollToHomeSectionWhenReady(sectionId, "smooth");
			});
		}
	};

	const handleMoreToggle = () => {
		activeSectionLockUntilRef.current = Date.now() + ACTIVE_SECTION_LOCK_MS;
		setIsMoreOpen((current) => !current);
	};

	return (
		<>
			<div
				aria-hidden="true"
				className="h-[calc(5.75rem+env(safe-area-inset-bottom))] md:hidden"
			/>
			<div
				className={cn(
					"fixed inset-x-0 bottom-0 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 transition-transform duration-300 ease-out md:hidden",
					isVisible && !hasActiveOverlay ? "translate-y-0" : "translate-y-full",
				)}
				style={{ zIndex: LAYERS.FLOATING_CONTROL }}
			>
				{isMoreOpen && (
					<div
						id="mobile-more-menu"
						className="mx-auto mb-2 max-w-md rounded-2xl border border-border/75 bg-card/96 p-3 shadow-[0_18px_48px_rgba(20,16,12,0.28)] backdrop-blur-xl"
					>
						<div className="flex items-center justify-between px-1 pb-2">
							<p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
								More
							</p>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => setIsMoreOpen(false)}
								className="size-8 rounded-full"
								aria-label="Close more menu"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
						<div className="grid gap-3">
							<div className="grid grid-cols-2 gap-1">
								<Link
									href={`${basePath || ""}/how-it-works`}
									className="flex min-h-12 flex-col justify-center gap-1 rounded-xl px-3 py-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground"
								>
									<Info className="h-4 w-4" />
									<span>How it works</span>
								</Link>
								<Link
									href={`${basePath || ""}/feature-event`}
									className="flex min-h-12 flex-col justify-center gap-1 rounded-xl px-3 py-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground"
								>
									<Megaphone className="h-4 w-4" />
									<span>Promote</span>
								</Link>
							</div>
							<div>
								<p className="px-1 pb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
									Essentials
								</p>
								<div className="grid grid-cols-2 gap-1">
									<button
										type="button"
										onClick={() => {
											setIsMoreOpen(false);
											setIsMusicModalOpen(true);
										}}
										className="flex min-h-12 flex-col justify-center gap-1 rounded-xl px-3 py-2 text-left text-sm text-foreground/85 hover:bg-accent hover:text-foreground"
									>
										<Music2 className="h-4 w-4" />
										<span>Playlist</span>
									</button>
									<Link
										href="https://maps.app.goo.gl/YZdYYpsh2ViR2tQi8?g_st=i"
										target="_blank"
										rel="noopener noreferrer"
										className="grid min-h-12 grid-cols-[1fr_auto] items-start gap-2 rounded-xl px-3 py-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground"
									>
										<span className="flex flex-col gap-1">
											<Utensils className="h-4 w-4" />
											<span>Food</span>
										</span>
										<ExternalLink className="mt-0.5 h-3 w-3 opacity-55" />
									</Link>
									<Link
										href={COMMUNITY_INVITE_CONFIG.WHATSAPP_URL}
										target="_blank"
										rel="noopener noreferrer"
										className="grid min-h-12 grid-cols-[1fr_auto] items-start gap-2 rounded-xl px-3 py-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground"
									>
										<span className="flex flex-col gap-1">
											<MessageCircle className="h-4 w-4" />
											<span>WhatsApp</span>
										</span>
										<ExternalLink className="mt-0.5 h-3 w-3 opacity-55" />
									</Link>
									<Link
										href={toiletFinderUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="grid min-h-12 grid-cols-[1fr_auto] items-start gap-2 rounded-xl px-3 py-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground"
									>
										<span className="flex flex-col gap-1">
											<Toilet className="h-4 w-4" />
											<span>Toilets</span>
										</span>
										<ExternalLink className="mt-0.5 h-3 w-3 opacity-55" />
									</Link>
									<Link
										href="https://outofofficecollective.co.uk/faqs"
										target="_blank"
										rel="noopener noreferrer"
										className="grid min-h-12 grid-cols-[1fr_auto] items-start gap-2 rounded-xl px-3 py-2 text-sm text-foreground/85 hover:bg-accent hover:text-foreground"
									>
										<span className="flex flex-col gap-1">
											<CircleHelp className="h-4 w-4" />
											<span>FAQs</span>
										</span>
										<ExternalLink className="mt-0.5 h-3 w-3 opacity-55" />
									</Link>
								</div>
							</div>
						</div>
					</div>
				)}
				<nav
					aria-label="Mobile primary"
					className="relative mx-auto grid max-w-md grid-cols-5 rounded-2xl border border-border/80 bg-card/96 p-1 shadow-[0_14px_34px_rgba(20,16,12,0.24)] backdrop-blur-xl"
				>
					<button
						type="button"
						onClick={handlePinToggle}
						className={cn(
							"absolute -top-3 left-3 z-20 flex size-7 items-center justify-center rounded-full border border-border/70 bg-card/96 text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground",
							isPinned && "text-foreground",
						)}
						aria-label={
							isPinned ? "Unpin mobile navigation" : "Pin mobile navigation"
						}
						aria-pressed={isPinned}
					>
						{isPinned ? (
							<PinOff className="h-3 w-3" />
						) : (
							<Pin className="h-3 w-3" />
						)}
					</button>
					{resolvedActiveIndex >= 0 && (
						<span
							className="pointer-events-none absolute bottom-1 left-1 top-1 z-0 rounded-xl bg-primary transition-transform duration-300 ease-out"
							style={{
								width: "calc((100% - 0.5rem) / 5)",
								transform: `translateX(calc(${resolvedActiveIndex} * 100%))`,
							}}
							aria-hidden="true"
						/>
					)}
					{navItems.map((item) => {
						const Icon = item.icon;
						const isItemVisuallyActive = item.isActive && !isMoreActive;
						return (
							<Link
								key={item.label}
								href={item.href}
								scroll={item.sectionId ? false : undefined}
								onClick={() => handleNavItemClick(item.key, item.sectionId)}
								className={cn(
									"relative z-10 flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
									isItemVisuallyActive &&
										"text-primary-foreground hover:text-primary-foreground",
								)}
								aria-current={isItemVisuallyActive ? "page" : undefined}
							>
								<Icon className="h-4 w-4" />
								<span>{item.label}</span>
							</Link>
						);
					})}
					<button
						type="button"
						onClick={handleMoreToggle}
						className={cn(
							"relative z-10 flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
							isMoreActive &&
								"text-primary-foreground hover:text-primary-foreground",
						)}
						aria-expanded={isMoreOpen}
						aria-controls="mobile-more-menu"
					>
						<Menu className="h-4 w-4" />
						<span>More</span>
					</button>
				</nav>
			</div>
			<MusicPlatformModal
				isOpen={isMusicModalOpen}
				onClose={() => setIsMusicModalOpen(false)}
			/>
		</>
	);
}
