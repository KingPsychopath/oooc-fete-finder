"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import { useEventsOffline } from "@/features/events/components/events-offline-provider";
import { useEffect, useMemo, useState } from "react";

interface ServiceWorkerOfflineStatus {
	cacheNames: {
		appShell: string;
		static: string;
		safeApi: string;
	};
	cacheVersion: string;
	type: "OFFLINE_STATUS";
}

const DEBUG_STORAGE_KEY = "oooc_offline_debug";

const formatDateTime = (value: number | string | null) => {
	if (value == null) return "none";
	try {
		return new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		}).format(new Date(value));
	} catch {
		return "invalid";
	}
};

const shouldShowDebugPanel = () => {
	if (process.env.NODE_ENV === "development") return true;
	if (process.env.NEXT_PUBLIC_OFFLINE_DEBUG === "1") return true;
	if (typeof window === "undefined") return false;
	const params = new URLSearchParams(window.location.search);
	return (
		params.get("offlineDebug") === "1" ||
		window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1"
	);
};

const readServiceWorkerStatus =
	async (): Promise<ServiceWorkerOfflineStatus | null> => {
		if (typeof navigator === "undefined" || !navigator.serviceWorker) {
			return null;
		}

		const registration = await navigator.serviceWorker.ready.catch(() => null);
		const worker =
			navigator.serviceWorker.controller ??
			registration?.active ??
			registration?.waiting ??
			registration?.installing;
		if (!worker) return null;

		return new Promise((resolve) => {
			const channel = new MessageChannel();
			const timeoutId = window.setTimeout(() => resolve(null), 1000);
			channel.port1.onmessage = (event) => {
				window.clearTimeout(timeoutId);
				const data = event.data as ServiceWorkerOfflineStatus | undefined;
				resolve(data?.type === "OFFLINE_STATUS" ? data : null);
			};
			worker.postMessage({ type: "GET_OFFLINE_STATUS" }, [channel.port2]);
		});
	};

export function OfflineDebugPanel() {
	const [isVisible, setIsVisible] = useState(false);
	const [serviceWorkerStatus, setServiceWorkerStatus] =
		useState<ServiceWorkerOfflineStatus | null>(null);
	const [browserCacheNames, setBrowserCacheNames] = useState<string[]>([]);
	const {
		authMode,
		canUseProtectedDiscovery,
		isAuthenticated,
		isOnline,
		offlineGraceExpiresAt,
	} = useOptionalAuth();
	const {
		eventDataSource,
		eventSnapshotFreshness,
		eventSnapshotSavedAt,
		eventSnapshotSyncState,
		events,
	} = useEventsOffline();

	useEffect(() => {
		setIsVisible(shouldShowDebugPanel());
	}, []);

	useEffect(() => {
		if (!isVisible) return;

		let isCancelled = false;
		const loadDebugState = async () => {
			const [nextServiceWorkerStatus, nextCacheNames] = await Promise.all([
				readServiceWorkerStatus(),
				"caches" in window ? caches.keys() : Promise.resolve([]),
			]);
			if (isCancelled) return;
			setServiceWorkerStatus(nextServiceWorkerStatus);
			setBrowserCacheNames(nextCacheNames);
		};

		void loadDebugState();
		const intervalId = window.setInterval(loadDebugState, 5000);

		return () => {
			isCancelled = true;
			window.clearInterval(intervalId);
		};
	}, [isVisible]);

	const debugRows = useMemo(
		() => [
			["SW version", serviceWorkerStatus?.cacheVersion ?? "unavailable"],
			[
				"SW controller",
				typeof navigator !== "undefined" && navigator.serviceWorker?.controller
					? "controlled"
					: "not controlled",
			],
			["Browser online", isOnline ? "yes" : "no"],
			["Event data source", eventDataSource],
			["Event count", String(events.length)],
			["Snapshot saved", formatDateTime(eventSnapshotSavedAt)],
			["Snapshot freshness", eventSnapshotFreshness],
			["Snapshot sync", eventSnapshotSyncState],
			["Auth mode", authMode],
			["Authenticated", isAuthenticated ? "yes" : "no"],
			["Protected discovery", canUseProtectedDiscovery ? "allowed" : "locked"],
			["Offline grace expires", formatDateTime(offlineGraceExpiresAt)],
			[
				"Cache names",
				browserCacheNames.length > 0 ? browserCacheNames.join(", ") : "none",
			],
		],
		[
			authMode,
			browserCacheNames,
			canUseProtectedDiscovery,
			eventDataSource,
			eventSnapshotFreshness,
			eventSnapshotSavedAt,
			eventSnapshotSyncState,
			events.length,
			isAuthenticated,
			isOnline,
			offlineGraceExpiresAt,
			serviceWorkerStatus,
		],
	);

	if (!isVisible) return null;

	return (
		<details className="mb-6 rounded-md border border-dashed border-border/80 bg-background/80 px-4 py-3 text-xs text-muted-foreground">
			<summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/75">
				Offline Debug
			</summary>
			<dl className="mt-3 grid gap-2 sm:grid-cols-[minmax(8rem,0.45fr)_1fr]">
				{debugRows.map(([label, value]) => (
					<div className="contents" key={label}>
						<dt className="font-medium text-foreground/70">{label}</dt>
						<dd className="break-words font-mono text-[11px] text-muted-foreground">
							{value}
						</dd>
					</div>
				))}
			</dl>
		</details>
	);
}
