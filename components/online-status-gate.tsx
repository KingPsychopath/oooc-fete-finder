"use client";

import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
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
const ONLINE_PROBE_INTERVAL_MS = 60_000;
const ONLINE_PROBE_DEBOUNCE_MS = 2_000;
const DEFAULT_ONLINE_STATUS = true;

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
	const [isOnline, setIsOnline] = useState(DEFAULT_ONLINE_STATUS);
	const inFlightProbeRef = useRef<Promise<boolean> | null>(null);
	const lastProbeStartedAtRef = useRef(0);
	const lastForcedProbeStartedAtRef = useRef(0);

	const refreshOnlineStatus = useCallback((force = false) => {
		if (!readBrowserOnlineStatus()) {
			setIsOnline(false);
			return;
		}

		const now = Date.now();
		const inFlightProbe = inFlightProbeRef.current;
		if (inFlightProbe) {
			void inFlightProbe.then(setIsOnline);
			return;
		}
		if (
			!force &&
			now - lastProbeStartedAtRef.current < ONLINE_PROBE_INTERVAL_MS
		) {
			return;
		}
		if (
			force &&
			now - lastForcedProbeStartedAtRef.current < ONLINE_PROBE_DEBOUNCE_MS
		) {
			return;
		}

		if (force) lastForcedProbeStartedAtRef.current = now;
		lastProbeStartedAtRef.current = now;
		const probe = probeAppReachability().finally(() => {
			if (inFlightProbeRef.current === probe) {
				inFlightProbeRef.current = null;
			}
		});
		inFlightProbeRef.current = probe;
		void probe.then(setIsOnline);
	}, []);

	useEffect(() => {
		refreshOnlineStatus();

		const handleOnline = () => refreshOnlineStatus(true);
		const handleOffline = () => setIsOnline(false);
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				refreshOnlineStatus(true);
			}
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		window.addEventListener("focus", handleOnline);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		const probeInterval = window.setInterval(
			() => refreshOnlineStatus(),
			ONLINE_PROBE_INTERVAL_MS,
		);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener("focus", handleOnline);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
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
	return context?.isOnline ?? DEFAULT_ONLINE_STATUS;
}

export function useOfflineFallbackGate() {
	const context = useContext(OnlineStatusContext);
	return context?.isOfflineFallbackActive ?? !DEFAULT_ONLINE_STATUS;
}
