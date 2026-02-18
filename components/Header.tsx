"use client";

import { Clock } from "@/components/Clock";
import MusicPlatformModal from "@/components/MusicPlatformModal";
import QuickActionsDropdown from "@/components/QuickActionsDropdown";
import SlidingBanner from "@/components/SlidingBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useOptionalAuth } from "@/features/auth/auth-context";
import Countdown from "@/features/events/components/Countdown";
import type { SlidingBannerPublicSettings } from "@/features/site-settings/types";
// Note: Using process.env directly to avoid server-side env variable access on client
import { LogOut, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Get base path from environment variable directly
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

const COMPRESS_THRESHOLD = 14;
const COLLAPSE_THRESHOLD = 44;
const DEFAULT_BANNER_MESSAGES = [
	"Curated by Out Of Office Collective",
	"Paris summer rhythm, mapped live",
	"Postgres-first event workflow",
	"Tap essentials for playlist, food and toilets",
];
const EXTERNAL_NAV_LINKS = [
	{
		label: "FAQs",
		href: "https://outofofficecollective.co.uk/faqs",
	},
	{
		label: "Contact",
		href: "https://outofofficecollective.co.uk/contact",
	},
] as const;

const DEFAULT_BANNER_SETTINGS: SlidingBannerPublicSettings = {
	enabled: true,
	messages: DEFAULT_BANNER_MESSAGES,
	messageDurationMs: 4200,
	desktopMessageCount: 2,
	updatedAt: new Date(0).toISOString(),
};

type HeaderProps = {
	bannerSettings?: SlidingBannerPublicSettings;
};

const Header = ({ bannerSettings = DEFAULT_BANNER_SETTINGS }: HeaderProps) => {
	const { isAuthenticated, isAdminAuthenticated, userEmail, logout } =
		useOptionalAuth();
	const pathname = usePathname();
	const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
	const [scrollState, setScrollState] = useState({
		compressed: false,
		collapsed: false,
	});
	const normalizedPathname = (pathname || "/").replace(/\/+$/, "") || "/";
	const pathWithoutBasePath =
		basePath && basePath !== "/" && normalizedPathname.startsWith(basePath)
			? normalizedPathname.slice(basePath.length) || "/"
			: normalizedPathname;
	const isFeatureEventPage =
		pathWithoutBasePath === "/feature-event" ||
		pathWithoutBasePath.startsWith("/feature-event/") ||
		pathWithoutBasePath === "/featured-event" ||
		pathWithoutBasePath.startsWith("/featured-event/");

	useEffect(() => {
		let rafId: number | null = null;
		let lastY = -1;

		const tick = () => {
			rafId = null;
			const y = window.scrollY;
			if (y === lastY) return;
			lastY = y;
			setScrollState({
				compressed: y > COMPRESS_THRESHOLD,
				collapsed: y > COLLAPSE_THRESHOLD,
			});
		};

		const onScroll = () => {
			if (rafId === null) rafId = requestAnimationFrame(tick);
		};

		tick();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	}, []);

	const isCompressed = scrollState.compressed;
	const isCollapsed = scrollState.collapsed;

	return (
		<>
			<header
				className={`sticky top-0 z-50 px-3 transition-[padding-top] duration-300 ease-out sm:px-4 ${
					isCompressed ? "pt-1.5 sm:pt-2" : "pt-2 sm:pt-3"
				}`}
			>
				<div
					className={`mx-auto w-full max-w-[1400px] rounded-2xl border ${
						isCompressed
							? "border-border/75 bg-card/95 shadow-[0_10px_26px_rgba(20,16,12,0.22)] backdrop-blur-xl"
							: "border-border/65 bg-card/86 shadow-[0_6px_18px_rgba(20,16,12,0.16)] backdrop-blur-lg"
					}`}
				>
					<div
						className={`mx-auto flex min-h-[72px] items-center gap-3 px-3 py-3 transition-transform duration-300 ease-out will-change-transform sm:min-h-[84px] sm:px-5 lg:grid lg:grid-cols-[minmax(260px,1fr)_auto_minmax(260px,1fr)] lg:gap-6 ${
							isCompressed ? "scale-[0.94] sm:scale-[0.96]" : "scale-100"
						}`}
					>
						<Link
							href={basePath || "/"}
							className="flex min-w-0 items-center gap-3 transition-colors hover:opacity-90 lg:justify-self-start"
							aria-label="Fete Finder home"
						>
							<div
								className={`relative h-10 w-10 shrink-0 transition-transform duration-300 ease-out will-change-transform sm:h-12 sm:w-12 ${
									isCompressed ? "scale-90 sm:scale-92" : "scale-100"
								}`}
							>
								<Image
									src={`${basePath}/OOOCLogoDark.svg`}
									alt=""
									fill
									priority
									sizes="(max-width: 640px) 40px, 48px"
									className="object-contain transition-transform hover:scale-105 dark:invert"
								/>
							</div>
							<div className="min-w-0">
								<p className="truncate text-[10px] uppercase tracking-[0.26em] text-foreground/55 sm:text-[11px]">
									Out Of Office Collective
								</p>
								<h1 className="truncate text-lg leading-none [font-family:var(--ooo-font-display)] font-light text-foreground sm:text-2xl">
									Fete Finder
								</h1>
							</div>
						</Link>

						<nav
							className="hidden items-center gap-6 lg:flex lg:justify-self-center lg:gap-7"
							aria-label="Main"
						>
							{isFeatureEventPage && (
								<Link
									href={basePath || "/"}
									className="text-sm tracking-wide text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									Home
								</Link>
							)}
							{!isFeatureEventPage && (
								<Link
									href={`${basePath || ""}/feature-event`}
									className="text-sm tracking-wide text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									Promote
								</Link>
							)}
							{EXTERNAL_NAV_LINKS.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm tracking-wide text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									{link.label}
								</Link>
							))}
						</nav>

						<div className="ml-auto flex shrink-0 items-center justify-end gap-2.5 sm:gap-3 lg:ml-0 lg:justify-self-end lg:justify-end">
							<div className="hidden items-center gap-2 sm:flex">
								<Clock />
								<ThemeToggle className="h-9 w-9 rounded-full border border-border/80 bg-background/70 hover:bg-accent" />
							</div>
							{isAdminAuthenticated && (
								<Link
									href={`${basePath || ""}/admin`}
									className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 py-2 text-[11px] tracking-[0.08em] text-foreground/85 transition-colors hover:bg-accent"
								>
									<ShieldCheck className="h-3.5 w-3.5" />
									Admin
								</Link>
							)}

							<QuickActionsDropdown
								onMusicSelect={() => setIsMusicModalOpen(true)}
								triggerClassName="h-9 rounded-full border border-border/80 bg-background/70 px-3 text-[11px] tracking-[0.08em] text-foreground/85 hover:bg-accent"
								menuClassName="z-[80] rounded-xl border border-border bg-popover/95 shadow-[0_12px_36px_rgba(16,12,9,0.28)]"
							/>
							<div className="sm:hidden">
								<ThemeToggle className="h-9 w-9 rounded-full border border-border/80 bg-background/70 hover:bg-accent" />
							</div>
							{isAuthenticated && userEmail && (
								<Button
									variant="ghost"
									size="sm"
									onClick={logout}
									className="hidden h-9 w-9 rounded-full border border-border/80 bg-background/70 p-0 text-foreground/75 hover:bg-accent hover:text-foreground sm:inline-flex"
									title="Logout"
									aria-label="Logout"
								>
									<LogOut className="h-3.5 w-3.5" />
								</Button>
							)}
						</div>
					</div>

					<div
						className={`overflow-hidden border-t border-border/75 transition-all duration-300 ease-out ${
							isCollapsed
								? "max-h-0 border-transparent opacity-0"
								: "opacity-100"
						} ${isCompressed && !isCollapsed ? "max-h-10" : ""} ${
							!isCompressed && !isCollapsed ? "max-h-20" : ""
						}`}
					>
						<div className="px-3 pt-2 pb-2 sm:px-5 sm:pt-2.5 sm:pb-3">
							<Countdown isActive={!isCollapsed} />
						</div>
					</div>
				</div>
			</header>
			{bannerSettings.enabled && bannerSettings.messages.length > 0 && (
				<SlidingBanner
					messages={bannerSettings.messages}
					messageDurationMs={bannerSettings.messageDurationMs}
					desktopMessageCount={bannerSettings.desktopMessageCount}
					className="mx-3 mt-2 rounded-xl border border-white/35 bg-[rgba(246,241,233,0.78)] dark:border-white/16 dark:bg-[rgba(12,13,16,0.82)] sm:mx-4"
				/>
			)}
			<MusicPlatformModal
				isOpen={isMusicModalOpen}
				onClose={() => setIsMusicModalOpen(false)}
			/>
		</>
	);
};

export default Header;
