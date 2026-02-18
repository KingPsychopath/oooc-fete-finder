"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LAYERS } from "@/lib/ui/layers";
import {
	Download,
	HousePlus,
	Share2,
	Smartphone,
	Wifi,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallDismissalData = {
	count: number;
	timestamp: number;
};

const DISMISSAL_STORAGE_KEY = "fete-finder:pwa-install-dismissals";
const DEFAULT_DISMISSAL_DATA: InstallDismissalData = {
	count: 0,
	timestamp: 0,
};

const readDismissalData = (): InstallDismissalData => {
	try {
		const raw = localStorage.getItem(DISMISSAL_STORAGE_KEY);
		if (!raw) return DEFAULT_DISMISSAL_DATA;
		const parsed = JSON.parse(raw) as Partial<InstallDismissalData>;
		return {
			count: Number.isFinite(parsed.count) ? Number(parsed.count) : 0,
			timestamp: Number.isFinite(parsed.timestamp)
				? Number(parsed.timestamp)
				: 0,
		};
	} catch {
		return DEFAULT_DISMISSAL_DATA;
	}
};

const writeDismissalData = (data: InstallDismissalData) => {
	localStorage.setItem(DISMISSAL_STORAGE_KEY, JSON.stringify(data));
};

export function PWAInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [isIOS, setIsIOS] = useState(false);

	useEffect(() => {
		// Check if already installed
		const isInstalled = () => {
			const iosNavigator = window.navigator as Navigator & {
				standalone?: boolean;
			};
			return (
				window.matchMedia("(display-mode: standalone)").matches ||
				iosNavigator.standalone === true
			);
		};

		// Check if recently dismissed with progressive delays
		const isRecentlyDismissed = () => {
			const dismissalData = readDismissalData();
			const { count, timestamp } = dismissalData;

			if (count === 0) return false; // Never dismissed

			const hoursSince = (Date.now() - timestamp) / (1000 * 60 * 60);

			// Progressive delays: 1st dismissal = 1 hour, 2nd = 24 hours, 3rd+ = 7 days
			if (count === 1 && hoursSince < 1) return true;
			if (count === 2 && hoursSince < 24) return true;
			if (count >= 3 && hoursSince < 168) return true; // 7 days

			return false;
		};

		// Don't show if already installed or recently dismissed
		if (isInstalled() || isRecentlyDismissed()) {
			return;
		}

		// Detect iOS
		const detectIOS =
			/iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
		setIsIOS(detectIOS);

		// For iOS, show instructions immediately
		if (detectIOS) {
			setIsVisible(true);
			return;
		}

		// For other browsers, wait for beforeinstallprompt
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			const event = e as BeforeInstallPromptEvent;
			setDeferredPrompt(event);
			setIsVisible(true);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
		};
	}, []);

	const handleInstall = async () => {
		if (!deferredPrompt) return;

		try {
			await deferredPrompt.prompt();
			const choiceResult = await deferredPrompt.userChoice;

			if (choiceResult.outcome === "accepted") {
				setIsVisible(false);
			}
		} catch (error) {
			console.warn("Install prompt failed:", error);
		} finally {
			setDeferredPrompt(null);
		}
	};

	const handleDismiss = () => {
		setIsVisible(false);

		// Update dismissal count and timestamp
		const currentData = readDismissalData();
		const newData: InstallDismissalData = {
			count: currentData.count + 1,
			timestamp: Date.now(),
		};
		writeDismissalData(newData);
	};

	if (!isVisible) {
		return null;
	}

	return (
		<div
			className="pointer-events-none fixed inset-x-0 px-4 sm:px-6"
			style={{
				bottom: "max(1rem, env(safe-area-inset-bottom))",
				zIndex: LAYERS.FLOATING_PROMPT,
			}}
		>
			<div className="pointer-events-auto mx-auto w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500">
				<Card className="overflow-hidden rounded-2xl border backdrop-blur-[9px] [border-color:color-mix(in_oklab,var(--border)_84%,rgba(23,16,11,0.14))] [background:linear-gradient(145deg,rgba(255,255,255,0.56)_10%,rgba(255,255,255,0)_65%),color-mix(in_oklab,var(--card)_90%,rgba(250,246,239,0.3))] [box-shadow:0_20px_40px_-28px_rgba(20,14,10,0.6),0_1px_0_rgba(255,255,255,0.42)_inset] dark:[border-color:color-mix(in_oklab,var(--border)_84%,rgba(255,255,255,0.12))] dark:[background:linear-gradient(145deg,rgba(255,255,255,0.14)_10%,rgba(255,255,255,0)_65%),color-mix(in_oklab,var(--card)_91%,rgba(17,13,10,0.4))] dark:[box-shadow:0_22px_40px_-30px_rgba(0,0,0,0.78),0_1px_0_rgba(255,255,255,0.08)_inset]">
					<CardHeader className="pb-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="mb-2 text-[0.64rem] uppercase tracking-[0.22em] text-muted-foreground/85">
									Out Of Office Collective
								</p>
								<div className="flex items-center gap-2">
									<div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/72">
										<Smartphone className="h-4 w-4 text-foreground/88" />
									</div>
									<CardTitle className="text-[1.45rem] leading-none [font-family:var(--ooo-font-display)] font-light tracking-[0.02em]">
										Install Fête Finder
									</CardTitle>
								</div>
								<CardDescription className="mt-3 text-sm leading-relaxed text-muted-foreground">
									Add the app for quicker loading, offline access, and
									home-screen launch.
								</CardDescription>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleDismiss}
								className="mt-0.5 size-8 shrink-0 rounded-full border border-border/55 bg-background/65 hover:bg-accent"
								aria-label="Dismiss install prompt"
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-3 pt-0">
						<div className="grid grid-cols-3 gap-2">
							<div className="rounded-xl border border-border/65 bg-background/58 p-2 text-center">
								<Wifi className="mx-auto h-3.5 w-3.5 text-foreground/86" />
								<p className="mt-1 text-[11px] leading-tight text-muted-foreground">
									Offline-ready
								</p>
							</div>
							<div className="rounded-xl border border-border/65 bg-background/58 p-2 text-center">
								<Zap className="mx-auto h-3.5 w-3.5 text-foreground/86" />
								<p className="mt-1 text-[11px] leading-tight text-muted-foreground">
									Faster launch
								</p>
							</div>
							<div className="rounded-xl border border-border/65 bg-background/58 p-2 text-center">
								<HousePlus className="mx-auto h-3.5 w-3.5 text-foreground/86" />
								<p className="mt-1 text-[11px] leading-tight text-muted-foreground">
									Home screen
								</p>
							</div>
						</div>

						{isIOS ? (
							<div className="space-y-3">
								<div className="rounded-xl border border-border/65 bg-background/58 p-3">
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Install On iPhone
									</p>
									<ol className="mt-2 space-y-2 text-sm text-muted-foreground">
										<li className="flex items-start gap-2">
											<span className="mt-0.5 inline-flex size-4 items-center justify-center rounded-full border border-border/70 text-[10px] text-foreground">
												1
											</span>
											<span>
												Tap{" "}
												<span className="font-medium text-foreground">
													Share
												</span>{" "}
												<Share2 className="mb-0.5 ml-1 inline h-3 w-3" />
											</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="mt-0.5 inline-flex size-4 items-center justify-center rounded-full border border-border/70 text-[10px] text-foreground">
												2
											</span>
											<span>Select "Add to Home Screen"</span>
										</li>
										<li className="flex items-start gap-2">
											<span className="mt-0.5 inline-flex size-4 items-center justify-center rounded-full border border-border/70 text-[10px] text-foreground">
												3
											</span>
											<span>Tap "Add" to confirm</span>
										</li>
									</ol>
								</div>
								<Button
									variant="outline"
									onClick={handleDismiss}
									className="h-9 w-full rounded-full border-border/70 bg-background/65 hover:bg-accent"
								>
									Got it
								</Button>
							</div>
						) : (
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
								<Button
									onClick={handleInstall}
									className="h-9 rounded-full border border-border/70 bg-primary text-primary-foreground hover:bg-primary/90"
								>
									<Download className="mr-1.5 h-3.5 w-3.5" />
									Install App
								</Button>
								<Button
									variant="outline"
									onClick={handleDismiss}
									className="h-9 rounded-full border-border/70 bg-background/65 hover:bg-accent"
								>
									Maybe later
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
