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
	const [showPrompt, setShowPrompt] = useState(false);
	const [isInstalled, setIsInstalled] = useState(false);
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		// Mark as client-side to avoid SSR issues
		setIsClient(true);

		// Check if already installed
		const checkInstalled = () => {
			if (typeof window === 'undefined') return;
			
			// @ts-ignore - checking for PWA display mode
			const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
			// @ts-ignore - checking for iOS PWA
			const isIOS = window.navigator?.standalone;
			const installed = isStandalone || isIOS;
			setIsInstalled(installed);
		};

		checkInstalled();

		// Listen for PWA install prompt
		const handleBeforeInstallPrompt = (e: Event) => {
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			// Stash the event so it can be triggered later
			const event = e as BeforeInstallPromptEvent;
			setDeferredPrompt(event);
			// Show our custom install prompt
			setShowPrompt(true);
		};

		// Listen for successful app install
		const handleAppInstalled = () => {
			setIsInstalled(true);
			setShowPrompt(false);
			setDeferredPrompt(null);
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.addEventListener('appinstalled', handleAppInstalled);
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
				window.removeEventListener('appinstalled', handleAppInstalled);
			}
		};
	}, []);

	const handleInstall = async () => {
		if (!deferredPrompt) return;

		try {
			// Show the install prompt
			await deferredPrompt.prompt();
			
			// Wait for the user to respond to the prompt
			const choiceResult = await deferredPrompt.userChoice;
			const { outcome } = choiceResult;

			if (outcome === 'accepted') {
				setIsInstalled(true);
			}

			// Clear the deferredPrompt
			setDeferredPrompt(null);
			setShowPrompt(false);
		} catch {
			// Silently handle errors - user can try manual install
		}
	};

	const handleDismiss = () => {
		setShowPrompt(false);
		// Remember dismissal with timestamp for less frequent prompts
		if (typeof window !== 'undefined') {
			const dismissalData = {
				timestamp: Date.now(),
				count: (JSON.parse(sessionStorage.getItem('pwa-install-dismissals') || '{"count": 0}').count || 0) + 1
			};
			sessionStorage.setItem('pwa-install-dismissals', JSON.stringify(dismissalData));
		}
	};

	// Don't render anything on server side
	if (!isClient) {
		return null;
	}

	// Check dismissal logic inline
	const canShowPrompt = () => {
		if (typeof window === 'undefined') return false;
		
		const dismissalData = JSON.parse(sessionStorage.getItem('pwa-install-dismissals') || '{"count": 0, "timestamp": 0}');
		const { count, timestamp } = dismissalData;
		
		if (count === 0) return true; // Never dismissed
		
		const hoursSinceDismissal = (Date.now() - timestamp) / (1000 * 60 * 60);
		
		// Progressive delays: 1st dismissal = 1 hour, 2nd = 24 hours, 3rd+ = 7 days
		if (count === 1 && hoursSinceDismissal < 1) return false;
		if (count === 2 && hoursSinceDismissal < 24) return false;
		if (count >= 3 && hoursSinceDismissal < 168) return false; // 7 days
		
		return true;
	};

	// Don't show if conditions not met
	if (isInstalled || !canShowPrompt() || !showPrompt || !deferredPrompt) {
		return null;
	}

	return (
		<div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom-2 duration-300">
			<Card className="shadow-lg border-2 bg-background/95 backdrop-blur-sm dark:bg-background/95">
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
							aria-label="Dismiss install prompt"
							title="Dismiss"
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
						<div className="flex flex-col gap-2">
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
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
} 