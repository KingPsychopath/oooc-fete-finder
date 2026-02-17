"use client";

import { Clock } from "@/components/Clock";
import Countdown from "@/components/Countdown";
import MusicPlatformModal from "@/components/MusicPlatformModal";
import QuickActionsDropdown from "@/components/QuickActionsDropdown";
import SlidingBanner from "@/components/SlidingBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
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

	useEffect(() => {
		const onScroll = () => {
			setIsCompressed(window.scrollY > 22);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<>
			<header className="sticky top-0 z-50 px-3 pt-2 sm:px-4 sm:pt-3">
				<div
					className={`mx-auto w-full max-w-[1400px] overflow-hidden rounded-2xl border transition-all duration-500 ${
						isCompressed ?
							"border-white/55 bg-[rgba(246,241,233,0.96)] shadow-[0_8px_32px_rgba(36,28,22,0.14)] backdrop-blur-xl"
						:	"border-white/40 bg-[rgba(246,241,233,0.84)] shadow-[0_4px_18px_rgba(36,28,22,0.09)] backdrop-blur-lg"
					}`}
				>
					<div
						className={`mx-auto flex items-center gap-3 px-3 sm:px-5 transition-all duration-500 ${
							isCompressed ?
								"min-h-[60px] py-2 sm:min-h-[66px]"
							:	"min-h-[72px] py-3 sm:min-h-[84px]"
						}`}
					>
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<Link
								href="https://outofofficecollective.co.uk"
								target="_blank"
								rel="noopener noreferrer"
								className={`relative shrink-0 transition-all duration-500 ${
									isCompressed ? "h-9 w-9 sm:h-10 sm:w-10" : "h-10 w-10 sm:h-12 sm:w-12"
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
								<ThemeToggle />
							</div>

							<QuickActionsDropdown onMusicSelect={() => setIsMusicModalOpen(true)} />
							<div className="sm:hidden">
								<ThemeToggle />
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
										className="h-7 w-7 p-0"
										title="Logout"
									>
										<LogOut className="h-3.5 w-3.5" />
									</Button>
								</div>
							)}
						</div>
					</div>

					<div
						className={`overflow-hidden border-t border-black/10 transition-all duration-500 ${
							isCompressed ? "max-h-12" : "max-h-20"
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
				className="mx-3 mt-2 rounded-xl border border-white/35 bg-[rgba(246,241,233,0.78)] sm:mx-4"
			/>
			<MusicPlatformModal
				isOpen={isMusicModalOpen}
				onClose={() => setIsMusicModalOpen(false)}
			/>
		</>
	);
};

export default Header;
