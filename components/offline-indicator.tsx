"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
			className={`fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300 ${className || ""}`}
		>
			<Card className="shadow-lg border-2">
				<CardContent className="p-3">
					<div className="flex items-center gap-2">
						{isOnline ? (
							<>
								<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
								<Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
									🟢 Back Online
								</Badge>
								<span className="text-sm text-green-600">
									All features available
								</span>
							</>
						) : (
							<>
								<div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
								<Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
									🟠 Offline Mode
								</Badge>
								<span className="text-sm text-orange-600">
									Using cached data
								</span>
							</>
						)}
					</div>
					{!isOnline && (
						<div className="mt-2 text-xs text-gray-500">
							✅ Events still available from cache
							<br />
							⚠️ Some features may be limited
						</div>
					)}
				</CardContent>
			</Card>
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