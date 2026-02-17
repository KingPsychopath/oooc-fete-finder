"use client";

import { Clock } from "@/components/Clock";
import Countdown from "@/features/events/components/Countdown";
import MusicPlatformModal from "@/components/MusicPlatformModal";
import QuickActionsDropdown from "@/components/QuickActionsDropdown";
import SlidingBanner from "@/components/SlidingBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
// Note: Using process.env directly to avoid server-side env variable access on client
import { LogOut, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

// Get base path from environment variable directly
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

const Header = () => {
	const { isAuthenticated, userEmail, logout } = useAuth();
	const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
	const [isCompressed, setIsCompressed] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			const y = window.scrollY;
			setIsCompressed(y > 14);
			setIsCollapsed(y > 44);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<>
			<header
				className={`sticky top-0 z-50 px-3 transition-all duration-500 sm:px-4 ${
					isCompressed ? "pt-1.5 sm:pt-2" : "pt-2 sm:pt-3"
				}`}
			>
				<div
					className={`mx-auto w-full max-w-[1400px] rounded-2xl border transition-all duration-500 ${
						isCompressed ?
							"border-border/75 bg-card/95 shadow-[0_10px_26px_rgba(20,16,12,0.22)] backdrop-blur-xl"
						:	"border-border/65 bg-card/86 shadow-[0_6px_18px_rgba(20,16,12,0.16)] backdrop-blur-lg"
					}`}
				>
					<div
						className={`mx-auto flex items-center gap-3 px-3 sm:px-5 transition-all duration-500 ${
							isCompressed ?
								"min-h-[52px] py-1.5 sm:min-h-[58px]"
							:	"min-h-[72px] py-3 sm:min-h-[84px]"
						}`}
					>
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<Link
								href="https://outofofficecollective.co.uk"
								target="_blank"
								rel="noopener noreferrer"
								className={`relative shrink-0 transition-all duration-500 ${
									isCompressed ? "h-8 w-8 sm:h-9 sm:w-9" : "h-10 w-10 sm:h-12 sm:w-12"
								}`}
							>
								<Image
									src={`${basePath}/OOOCLogoDark.svg`}
									alt="Out Of Office Collective"
									fill
									priority
									sizes="(max-width: 640px) 40px, 48px"
									className="object-contain transition-transform hover:scale-105 dark:invert"
								/>
							</Link>

							<div className="min-w-0">
								<p className="truncate text-[10px] uppercase tracking-[0.26em] text-foreground/55 sm:text-[11px]">
									Out Of Office Collective
								</p>
								<h1 className="truncate text-lg leading-none [font-family:var(--ooo-font-display)] font-light text-foreground sm:text-2xl">
									Fete Finder
								</h1>
							</div>
						</div>

						<nav className="hidden items-center gap-5 lg:flex">
							<Link
								href={basePath || "/"}
								className="text-sm tracking-wide text-foreground/85 underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Home
							</Link>
							<Link
								href={`${basePath || ""}/feature-event`}
								className="text-sm tracking-wide text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Featured Event
							</Link>
							<Link
								href="https://outofofficecollective.co.uk/faqs"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm tracking-wide text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								FAQs
							</Link>
							<Link
								href="https://outofofficecollective.co.uk/contact"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm tracking-wide text-foreground/75 underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Contact
							</Link>
						</nav>

						<div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
							<div className="hidden items-center gap-2 sm:flex">
								<Clock />
								<ThemeToggle className="h-9 w-9 rounded-full border border-border/80 bg-background/70 hover:bg-accent" />
							</div>

							<QuickActionsDropdown
								onMusicSelect={() => setIsMusicModalOpen(true)}
								triggerClassName="h-9 rounded-full border border-border/80 bg-background/70 px-3 text-[11px] tracking-[0.08em] text-foreground/85 hover:bg-accent"
								menuClassName="z-[80] rounded-xl border border-border bg-popover/95 shadow-[0_12px_36px_rgba(16,12,9,0.28)]"
							/>
							<div className="sm:hidden">
								<ThemeToggle className="h-8 w-8 rounded-full border border-border/80 bg-background/70 hover:bg-accent" />
							</div>
							{isAuthenticated && userEmail && (
								<div className="hidden items-center gap-2 sm:flex">
									<Badge variant="secondary" className="gap-1 text-xs">
										<User className="h-3 w-3" />
										<span className="max-w-[80px] truncate">
											{userEmail.split("@")[0]}
										</span>
									</Badge>
									<Button
										variant="ghost"
										size="sm"
										onClick={logout}
										className="h-8 rounded-full border border-border/80 bg-background/70 px-2 text-foreground/75 hover:bg-accent hover:text-foreground"
										title="Logout"
									>
										<LogOut className="h-3.5 w-3.5" />
									</Button>
								</div>
							)}
						</div>
					</div>

					<div
						className={`overflow-hidden border-t border-border/75 transition-all duration-500 ${
							isCollapsed ? "max-h-0 border-transparent opacity-0" : "opacity-100"
						} ${isCompressed && !isCollapsed ? "max-h-10" : ""} ${
							!isCompressed && !isCollapsed ? "max-h-20" : ""
						}`}
					>
						<div className="px-3 pb-2 sm:px-5 sm:pb-3">
							<Countdown />
						</div>
					</div>
				</div>
			</header>
			<SlidingBanner
				messages={[
					"Curated by Out Of Office Collective",
					"Paris summer rhythm, mapped live",
					"Postgres-first event workflow",
					"Tap essentials for playlist, food and toilets",
				]}
				speed={15}
				className="mx-3 mt-2 rounded-xl border border-white/35 bg-[rgba(246,241,233,0.78)] dark:border-white/14 dark:bg-[rgba(25,20,16,0.68)] sm:mx-4"
			/>
			<MusicPlatformModal
				isOpen={isMusicModalOpen}
				onClose={() => setIsMusicModalOpen(false)}
			/>
		</>
	);
};

export default Header;
