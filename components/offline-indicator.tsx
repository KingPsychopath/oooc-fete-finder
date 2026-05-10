"use client";

import { LAYERS } from "@/lib/ui/layers";
import { useEffect, useState } from "react";
import { useOfflineFallbackGate, useOnlineStatus } from "./online-status-gate";

interface OfflineIndicatorProps {
	className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
	const isOnline = useOnlineStatus();
	const isOfflineFallbackActive = useOfflineFallbackGate();
	const [showIndicator, setShowIndicator] = useState(false);

	useEffect(() => {
		if (isOfflineFallbackActive) {
			setShowIndicator(true);
			return;
		}

		if (!showIndicator) return;

		const hideTimeout = window.setTimeout(() => setShowIndicator(false), 3000);
		return () => window.clearTimeout(hideTimeout);
	}, [isOfflineFallbackActive, showIndicator]);

	if (!showIndicator) return null;

	return (
		<div
			className={`fixed animate-in slide-in-from-bottom-2 duration-300 ${className || ""}`}
			style={{
				right: "max(env(safe-area-inset-right), 1rem)",
				bottom: "max(env(safe-area-inset-bottom), 1rem)",
				zIndex: LAYERS.SYSTEM_TOAST,
			}}
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
 * Hook to detect online/offline status.
 */
export { useOnlineStatus } from "./online-status-gate";
