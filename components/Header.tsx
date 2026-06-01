"use client";

import { AppSettingsModal } from "@/components/AppSettingsModal";
import { Clock } from "@/components/Clock";
import MusicPlatformModal from "@/components/MusicPlatformModal";
import QuickActionsDropdown from "@/components/QuickActionsDropdown";
import SlidingBanner from "@/components/SlidingBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/features/auth/auth-context";
import Countdown from "@/features/events/components/Countdown";
import { trackNavigationClick } from "@/features/events/engagement/client-tracking";
import type { SlidingBannerPublicSettings } from "@/features/site-settings/types";
// Note: Using process.env directly to avoid server-side env variable access on client
import { LogOut, Route, UserRoundPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, lazy, useEffect, useState } from "react";

const EmailGateModal = lazy(
	() => import("@/features/auth/components/EmailGateModal"),
);

// Get base path from environment variable directly
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const ooocFaqUrl =
	process.env.NEXT_PUBLIC_OOOC_FAQ_URL?.trim() ||
	"https://outofofficecollective.co.uk/faqs";

const COMPRESS_ENTER_THRESHOLD = 24;
const COMPRESS_EXIT_THRESHOLD = 8;
const COLLAPSE_ENTER_THRESHOLD = 104;
const COLLAPSE_EXIT_THRESHOLD = 24;
const STICKY_HEADER_QUERY = "(min-width: 640px)";
const DEFAULT_BANNER_MESSAGES = [
	"Curated by Out Of Office Collective",
	"Paris summer rhythm, mapped live",
	"Postgres-first event workflow",
	"Tap essentials for playlist, food and toilets",
];
const EXTERNAL_NAV_LINKS = [
	{
		label: "FAQs",
		href: ooocFaqUrl,
	},
] as const;

const DEFAULT_BANNER_SETTINGS: SlidingBannerPublicSettings = {
	enabled: true,
	messages: DEFAULT_BANNER_MESSAGES,
	messageDurationMs: 4200,
	desktopMessageCount: 2,
	updatedAt: new Date(0).toISOString(),
};
const AUTH_ICON_BUTTON_CLASS =
	"hidden h-9 w-9 rounded-full border border-border/80 bg-background/70 p-0 text-foreground/75 hover:bg-accent hover:text-foreground sm:inline-flex";

type HeaderProps = {
	bannerSettings?: SlidingBannerPublicSettings;
};

const Header = ({ bannerSettings = DEFAULT_BANNER_SETTINGS }: HeaderProps) => {
	const {
		isAuthenticated,
		isAdminAuthenticated,
		isAuthResolved,
		isOnline,
		logout,
		refreshSession,
	} = useOptionalAuth();
	const pathname = usePathname();
	const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [isEmailGateOpen, setIsEmailGateOpen] = useState(false);
	const [scrollState, setScrollState] = useState({
		compressed: false,
		collapsed: false,
	});
	const normalizedPathname = (pathname || "/").replace(/\/+$/, "") || "/";
	const pathWithoutBasePath =
		basePath && basePath !== "/" && normalizedPathname.startsWith(basePath)
			? normalizedPathname.slice(basePath.length) || "/"
			: normalizedPathname;
	const isHomePage = pathWithoutBasePath === "/";
	const isHowItWorksPage =
		pathWithoutBasePath === "/how-it-works" ||
		pathWithoutBasePath.startsWith("/how-it-works/");
	const isPromotePage =
		pathWithoutBasePath === "/feature-event" ||
		pathWithoutBasePath.startsWith("/feature-event/") ||
		pathWithoutBasePath === "/featured-event" ||
		pathWithoutBasePath.startsWith("/featured-event/");
	const isSubmitPage =
		pathWithoutBasePath === "/submit-event" ||
		pathWithoutBasePath.startsWith("/submit-event/");
	const isPlansPage =
		pathWithoutBasePath === "/plans" ||
		pathWithoutBasePath.startsWith("/plans/");
	const trackHeaderNav = (label: string) => {
		if (!isHomePage) return;
		trackNavigationClick({ group: "header_nav", label });
	};

	useEffect(() => {
		const mediaQuery = window.matchMedia(STICKY_HEADER_QUERY);
		let rafId: number | null = null;
		let lastY = -1;
		let isCompressed = false;
		let isCollapsed = false;

		const setNextState = (compressed: boolean, collapsed: boolean) => {
			if (compressed === isCompressed && collapsed === isCollapsed) return;

			isCompressed = compressed;
			isCollapsed = collapsed;
			setScrollState({ compressed, collapsed });
		};

		const tick = () => {
			rafId = null;

			if (!mediaQuery.matches) {
				lastY = window.scrollY;
				setNextState(false, false);
				return;
			}

			const y = window.scrollY;
			if (y === lastY) return;
			lastY = y;

			const nextCompressed = isCompressed
				? y > COMPRESS_EXIT_THRESHOLD
				: y > COMPRESS_ENTER_THRESHOLD;
			const nextCollapsed = isCollapsed
				? y > COLLAPSE_EXIT_THRESHOLD
				: y > COLLAPSE_ENTER_THRESHOLD;

			setNextState(nextCompressed, nextCollapsed);
		};

		const scheduleTick = () => {
			if (rafId === null) rafId = requestAnimationFrame(tick);
		};

		const handleMediaChange = () => {
			lastY = -1;
			scheduleTick();
		};

		tick();
		window.addEventListener("scroll", scheduleTick, { passive: true });
		window.addEventListener("wheel", scheduleTick, { passive: true });
		window.addEventListener("touchmove", scheduleTick, { passive: true });
		mediaQuery.addEventListener("change", handleMediaChange);

		return () => {
			window.removeEventListener("scroll", scheduleTick);
			window.removeEventListener("wheel", scheduleTick);
			window.removeEventListener("touchmove", scheduleTick);
			mediaQuery.removeEventListener("change", handleMediaChange);
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	}, []);

	const handleEmailSubmit = async () => {
		const hasConfirmedSession = await refreshSession();
		if (hasConfirmedSession) {
			setIsEmailGateOpen(false);
			return true;
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 350);
		});
		const retryAfterDelay = await refreshSession();

		if (retryAfterDelay) {
			setIsEmailGateOpen(false);
			return true;
		}
		return false;
	};

	const isCompressed = scrollState.compressed;
	const isCollapsed = scrollState.collapsed;

	return (
		<>
			<header className="relative z-50 px-3 pt-2 sm:sticky sm:top-0 sm:px-4 sm:pt-3">
				<div className="relative mx-auto w-full max-w-[1400px] overflow-visible rounded-2xl border border-border/65 bg-card/86 shadow-[0_6px_18px_rgba(20,16,12,0.16)] backdrop-blur-lg 2xl:max-w-[1680px]">
					<div
						className="pointer-events-none absolute inset-0 rounded-2xl bg-[image:var(--ooo-grain-image)] bg-[length:220px_220px] opacity-[0.055] mix-blend-multiply dark:opacity-[0.075] dark:mix-blend-screen"
						aria-hidden="true"
					/>
					<div
						className="relative z-20 mx-auto flex min-h-[72px] origin-top items-center gap-3 px-3 py-3 transition-transform duration-200 ease-out will-change-transform sm:min-h-[84px] sm:px-5 lg:grid lg:grid-cols-[minmax(190px,1fr)_auto_minmax(170px,1fr)] lg:gap-4 xl:grid-cols-[minmax(260px,1fr)_auto_minmax(260px,1fr)] xl:gap-6"
						style={{
							transform: isCompressed ? "scale(0.97)" : "scale(1)",
						}}
					>
						<Link
							href={basePath || "/"}
							className="flex min-w-0 items-center gap-3 transition-colors hover:opacity-90 lg:justify-self-start"
							aria-label="Fete Finder home"
						>
							<div
								className="relative h-10 w-10 shrink-0 transition-transform duration-200 ease-out will-change-transform sm:h-12 sm:w-12"
								style={{
									transform: isCompressed ? "scale(0.95)" : "scale(1)",
								}}
							>
								<Image
									src={`${basePath}/OOOCLogoDark.svg`}
									alt=""
									fill
									unoptimized
									priority
									sizes="(max-width: 640px) 40px, 48px"
									className="object-contain transition-transform hover:scale-105 dark:invert"
								/>
							</div>
							<div className="min-w-0">
								<p className="truncate text-[10px] uppercase tracking-[0.26em] text-foreground/55 sm:text-[11px]">
									Out Of Office Collective
								</p>
								<p className="truncate text-lg leading-none [font-family:var(--ooo-font-display)] font-light text-foreground sm:text-2xl">
									Fete Finder
								</p>
							</div>
						</Link>

						<nav
							className="hidden items-center gap-5 lg:flex lg:justify-self-center xl:gap-7"
							aria-label="Main"
						>
							<Link
								href={basePath || "/"}
								onClick={() => trackHeaderNav("home")}
								className={`whitespace-nowrap text-sm tracking-wide underline-offset-4 transition-colors hover:text-foreground hover:underline ${
									isHomePage ? "text-foreground" : "text-foreground/75"
								}`}
							>
								Home
							</Link>
							<Link
								href={`${basePath || ""}/how-it-works`}
								onClick={() => trackHeaderNav("how_it_works")}
								className={`whitespace-nowrap text-sm tracking-wide underline-offset-4 transition-colors hover:text-foreground hover:underline ${
									isHowItWorksPage ? "text-foreground" : "text-foreground/75"
								}`}
							>
								How it works
							</Link>
							<Link
								href={`${basePath || ""}/submit-event`}
								onClick={() => trackHeaderNav("submit_event")}
								className={`whitespace-nowrap text-sm tracking-wide underline-offset-4 transition-colors hover:text-foreground hover:underline ${
									isSubmitPage ? "text-foreground" : "text-foreground/75"
								}`}
							>
								Submit Event
							</Link>
							<Link
								href={`${basePath || ""}/plans`}
								onClick={() => trackHeaderNav("plans")}
								className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm tracking-wide underline-offset-4 transition-colors hover:text-foreground hover:underline ${
									isPlansPage ? "text-foreground" : "text-foreground/75"
								}`}
							>
								<Route className="h-3.5 w-3.5" />
								Plans
							</Link>
							<Link
								href={`${basePath || ""}/feature-event`}
								onClick={() => trackHeaderNav("feature_event")}
								className={`whitespace-nowrap text-sm tracking-wide underline-offset-4 transition-colors hover:text-foreground hover:underline ${
									isPromotePage ? "text-foreground" : "text-foreground/75"
								}`}
							>
								Promote
							</Link>
							{EXTERNAL_NAV_LINKS.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									onClick={() => trackHeaderNav(link.label.toLowerCase())}
									target="_blank"
									rel="noopener noreferrer"
									className="whitespace-nowrap text-sm tracking-wide text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									{link.label}
								</Link>
							))}
						</nav>

						<div className="ml-auto flex shrink-0 items-center justify-end gap-2.5 sm:gap-3 lg:ml-0 lg:justify-self-end lg:justify-end">
							<div className="hidden items-center gap-2 sm:flex">
								<Clock />
								<ThemeToggle
									triggerId="header-theme-toggle-desktop"
									className="h-9 w-9 rounded-full border border-border/80 bg-background/70 hover:bg-accent"
								/>
							</div>

							<QuickActionsDropdown
								isAdminAuthenticated={isAdminAuthenticated}
								basePath={basePath}
								onMusicSelect={() => setIsMusicModalOpen(true)}
								onSettingsOpen={() => setIsSettingsOpen(true)}
								triggerClassName="h-9 rounded-full border border-border/80 bg-background/70 px-3 text-[11px] tracking-[0.08em] text-foreground/85 hover:bg-accent"
								menuClassName="z-[120] rounded-xl border border-border bg-popover/95 shadow-[0_12px_36px_rgba(16,12,9,0.28)]"
							/>
							<div className="sm:hidden">
								<ThemeToggle
									triggerId="header-theme-toggle-mobile"
									className="h-9 w-9 rounded-full border border-border/80 bg-background/70 hover:bg-accent"
								/>
							</div>
							{isAuthenticated && isAuthResolved ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={logout}
									className={AUTH_ICON_BUTTON_CLASS}
									title="Logout"
									aria-label="Logout"
								>
									<LogOut className="h-3.5 w-3.5" />
								</Button>
							) : (
								isAuthResolved &&
								isOnline && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											trackNavigationClick({
												group: "header_nav",
												label: "login",
											});
											setIsEmailGateOpen(true);
										}}
										className={AUTH_ICON_BUTTON_CLASS}
										title="Login"
										aria-label="Login"
									>
										<UserRoundPlus className="h-3.5 w-3.5" />
									</Button>
								)
							)}
						</div>
					</div>

					<div
						data-header-countdown-strip
						className="relative z-0 grid overflow-hidden border-border/75 transition-[grid-template-rows,border-width,opacity] duration-200 ease-out"
						style={{
							gridTemplateRows: isCollapsed ? "0fr" : "1fr",
							borderTopWidth: isCollapsed ? "0px" : "1px",
							opacity: isCollapsed ? 0 : 1,
						}}
						aria-hidden={isCollapsed}
					>
						<div className="min-h-0 overflow-hidden">
							<div className="px-3 pt-2 pb-2 sm:px-5 sm:pt-2.5 sm:pb-3">
								<Countdown isActive={!isCollapsed} />
							</div>
						</div>
					</div>
				</div>
			</header>
			{bannerSettings.enabled && bannerSettings.messages.length > 0 && (
				<SlidingBanner
					messages={bannerSettings.messages}
					messageDurationMs={bannerSettings.messageDurationMs}
					desktopMessageCount={bannerSettings.desktopMessageCount}
					className="mx-3 mt-2 border-y border-border/20 bg-background/10 dark:border-border/16 dark:bg-background/8 sm:mx-4"
				/>
			)}
			<MusicPlatformModal
				isOpen={isMusicModalOpen}
				onClose={() => setIsMusicModalOpen(false)}
			/>
			<AppSettingsModal
				isOpen={isSettingsOpen}
				onClose={() => setIsSettingsOpen(false)}
			/>
			{isEmailGateOpen && (
				<Suspense
					fallback={
						<span className="sr-only" aria-hidden="true">
							Loading
						</span>
					}
				>
					<EmailGateModal
						isOpen={isEmailGateOpen}
						onClose={() => setIsEmailGateOpen(false)}
						onEmailSubmit={handleEmailSubmit}
					/>
				</Suspense>
			)}
		</>
	);
};

export default Header;
