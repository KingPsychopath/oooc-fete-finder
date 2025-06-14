"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
	const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [isIOS, setIsIOS] = useState(false);

	useEffect(() => {
		// Check if already installed
		const isInstalled = () => {
			// @ts-ignore - checking for PWA display mode
			return window.matchMedia('(display-mode: standalone)').matches || 
				   // @ts-ignore - checking for iOS PWA
				   window.navigator?.standalone === true;
		};

		// Check if recently dismissed with progressive delays
		const isRecentlyDismissed = () => {
			const dismissalData = JSON.parse(localStorage.getItem('fete-finder:pwa-install-dismissals') || '{"count": 0, "timestamp": 0}');
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
		const detectIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
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

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		};
	}, []);

	const handleInstall = async () => {
		if (!deferredPrompt) return;

		try {
			await deferredPrompt.prompt();
			const choiceResult = await deferredPrompt.userChoice;
			
			if (choiceResult.outcome === 'accepted') {
				setIsVisible(false);
			}
		} catch (error) {
			console.warn('Install prompt failed:', error);
		} finally {
			setDeferredPrompt(null);
		}
	};

	const handleDismiss = () => {
		setIsVisible(false);
		
		// Update dismissal count and timestamp
		const currentData = JSON.parse(localStorage.getItem('fete-finder:pwa-install-dismissals') || '{"count": 0, "timestamp": 0}');
		const newData = {
			count: currentData.count + 1,
			timestamp: Date.now()
		};
		localStorage.setItem('fete-finder:pwa-install-dismissals', JSON.stringify(newData));
	};

	if (!isVisible) {
		return null;
	}

	return (
		<div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom-2 duration-300">
			<Card className="shadow-lg border-2 bg-background/95 backdrop-blur-sm">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Smartphone className="w-5 h-5 text-primary" />
							<CardTitle className="text-lg">Install Fête Finder</CardTitle>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDismiss}
							className="h-8 w-8 p-0"
							aria-label="Close"
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
					<CardDescription>
						Get the full app experience with offline access and faster loading
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<span>📱</span>
							<span>Works offline</span>
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<span>⚡</span>
							<span>Faster loading</span>
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<span>🏠</span>
							<span>Add to home screen</span>
						</div>
						
						<div className="flex flex-col gap-2 mt-2">
							{isIOS ? (
								<div className="text-sm space-y-2">
									<p className="font-medium">To install on iOS:</p>
									<ol className="list-decimal list-inside space-y-1 text-muted-foreground">
										<li>Tap the Share button (📤)</li>
										<li>Scroll down and tap "Add to Home Screen"</li>
										<li>Tap "Add" to confirm</li>
									</ol>
									<Button
										variant="outline"
										onClick={handleDismiss}
										size="sm"
										className="w-full mt-3"
									>
										Got it
									</Button>
								</div>
							) : (
								<>
									<Button
										onClick={handleInstall}
										className="w-full gap-2"
										size="sm"
									>
										<Download className="w-4 h-4" />
										Install App
									</Button>
									<Button
										variant="outline"
										onClick={handleDismiss}
										size="sm"
									>
										Maybe Later
									</Button>
								</>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
} 