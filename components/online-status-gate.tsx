"use client";

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

interface OnlineStatusContextValue {
	isOnline: boolean;
	isOfflineFallbackActive: boolean;
}

interface OnlineStatusProviderProps {
	children: ReactNode;
}

const OnlineStatusContext = createContext<OnlineStatusContextValue | null>(
	null,
);
const ONLINE_PROBE_PATH = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/client-health`;
const ONLINE_PROBE_TIMEOUT_MS =
	process.env.NODE_ENV === "development" ? 8000 : 3000;
const ONLINE_PROBE_ATTEMPTS = 2;

const readBrowserOnlineStatus = () =>
	typeof navigator === "undefined" || navigator.onLine;

const probeAppReachability = async (): Promise<boolean> => {
	if (typeof fetch === "undefined" || typeof window === "undefined") {
		return readBrowserOnlineStatus();
	}

	for (let attempt = 0; attempt < ONLINE_PROBE_ATTEMPTS; attempt += 1) {
		const controller = new AbortController();
		const timeout = window.setTimeout(
			() => controller.abort(),
			ONLINE_PROBE_TIMEOUT_MS,
		);

		try {
			const response = await fetch(
				`${ONLINE_PROBE_PATH}?onlineProbe=${Date.now()}-${attempt}`,
				{
					cache: "no-store",
					headers: { Accept: "application/json" },
					signal: controller.signal,
				},
			);
			if (response.ok) return true;
		} catch {
			// Retry once so a single transient failed request does not flip the UI.
		} finally {
			window.clearTimeout(timeout);
		}
	}

	return false;
};

export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
	const [isOnline, setIsOnline] = useState(true);

	const refreshOnlineStatus = useCallback(() => {
		if (!readBrowserOnlineStatus()) {
			setIsOnline(false);
			return;
		}

		void probeAppReachability().then(setIsOnline);
	}, []);

	useEffect(() => {
		refreshOnlineStatus();

		const handleOnline = () => refreshOnlineStatus();
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		window.addEventListener("focus", refreshOnlineStatus);
		document.addEventListener("visibilitychange", refreshOnlineStatus);

		const probeInterval = window.setInterval(refreshOnlineStatus, 15_000);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener("focus", refreshOnlineStatus);
			document.removeEventListener("visibilitychange", refreshOnlineStatus);
			window.clearInterval(probeInterval);
		};
	}, [refreshOnlineStatus]);

	const value = useMemo(
		() => ({
			isOnline,
			isOfflineFallbackActive: !isOnline,
		}),
		[isOnline],
	);

	return (
		<OnlineStatusContext.Provider value={value}>
			{children}
		</OnlineStatusContext.Provider>
	);
}

export function useOnlineStatus() {
	const context = useContext(OnlineStatusContext);
	return context?.isOnline ?? readBrowserOnlineStatus();
}

export function useOfflineFallbackGate() {
	const context = useContext(OnlineStatusContext);
	return context?.isOfflineFallbackActive ?? !readBrowserOnlineStatus();
}
