"use client";

import { LAYERS } from "@/lib/ui/layers";
import { useEffect, useState } from "react";

interface OfflineIndicatorProps {
	className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
	const [isOnline, setIsOnline] = useState(true);
	const [showIndicator, setShowIndicator] = useState(false);

	useEffect(() => {
		// Initial check
		setIsOnline(navigator.onLine);

		// Event listeners for online/offline status
		const handleOnline = () => {
			setIsOnline(true);
			// Show "back online" message briefly
			setShowIndicator(true);
			setTimeout(() => setShowIndicator(false), 3000);
		};

		const handleOffline = () => {
			setIsOnline(false);
			setShowIndicator(true);
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		// Show indicator if we're offline on mount
		if (!navigator.onLine) {
			setShowIndicator(true);
		}

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	if (!showIndicator) return null;

	return (
		<div
			className={`fixed bottom-4 right-4 animate-in slide-in-from-bottom-2 duration-300 ${className || ""}`}
			style={{ zIndex: LAYERS.SYSTEM_TOAST }}
		>
			{isOnline ? (
				<div className="bg-green-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-1.5">
					<div className="w-1.5 h-1.5 bg-white rounded-full" />
					Back online
				</div>
			) : (
				<div className="bg-orange-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-1.5">
					<div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
					Offline mode
				</div>
			)}
		</div>
	);
}

/**
 * Hook to detect online/offline status
 */
export function useOnlineStatus() {
	const [isOnline, setIsOnline] = useState(true);

	useEffect(() => {
		setIsOnline(navigator.onLine);

		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return isOnline;
}
