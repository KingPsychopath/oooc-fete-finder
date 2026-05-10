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
const ONLINE_PROBE_TIMEOUT_MS = 3000;

const readBrowserOnlineStatus = () =>
	typeof navigator === "undefined" || navigator.onLine;

async function canReachAppShell(): Promise<boolean> {
	if (typeof fetch === "undefined") return readBrowserOnlineStatus();

	const controller = new AbortController();
	const timeout = window.setTimeout(
		() => controller.abort(),
		ONLINE_PROBE_TIMEOUT_MS,
	);

	try {
		const response = await fetch(
			`${ONLINE_PROBE_PATH}?onlineProbe=${Date.now()}`,
			{
				cache: "no-store",
				headers: { Accept: "application/json" },
				signal: controller.signal,
			},
		);
		return response.ok;
	} catch {
		return false;
	} finally {
		window.clearTimeout(timeout);
	}
}

export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
	const [isOnline, setIsOnline] = useState(true);

	const refreshOnlineStatus = useCallback(() => {
		if (readBrowserOnlineStatus()) {
			setIsOnline(true);
			return;
		}

		void canReachAppShell().then(setIsOnline);
	}, []);

	useEffect(() => {
		refreshOnlineStatus();

		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => {
			void canReachAppShell().then(setIsOnline);
		};

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
