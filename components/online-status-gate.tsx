"use client";

import {
	type ReactNode,
	createContext,
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
const DEFAULT_ONLINE_STATUS = true;
const CLIENT_HEALTH_TIMEOUT_MS = 3000;
const CLIENT_HEALTH_RECHECK_MS = 60 * 1000;

const readBrowserOnlineStatus = () =>
	typeof navigator === "undefined" || navigator.onLine;

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
	const [isOnline, setIsOnline] = useState(DEFAULT_ONLINE_STATUS);

	useEffect(() => {
		let isCancelled = false;
		let latestProbeId = 0;
		const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
		const healthEndpoint = `${basePath}/api/client-health`;

		const probeReachability = async () => {
			if (!readBrowserOnlineStatus()) {
				setIsOnline(false);
				return;
			}

			const probeId = ++latestProbeId;
			const controller = new AbortController();
			const timeoutId = window.setTimeout(
				() => controller.abort(),
				CLIENT_HEALTH_TIMEOUT_MS,
			);

			try {
				const response = await fetch(healthEndpoint, {
					cache: "no-store",
					headers: { Accept: "application/json" },
					signal: controller.signal,
				});
				if (!isCancelled && probeId === latestProbeId) {
					setIsOnline(response.ok);
				}
			} catch {
				if (!isCancelled && probeId === latestProbeId) {
					setIsOnline(false);
				}
			} finally {
				window.clearTimeout(timeoutId);
			}
		};

		void probeReachability();

		const handleOnline = () => {
			void probeReachability();
		};
		const handleOffline = () => setIsOnline(false);
		const handleFocus = () => {
			void probeReachability();
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void probeReachability();
			}
		};
		const recheckIntervalId = window.setInterval(() => {
			if (document.visibilityState === "visible") {
				void probeReachability();
			}
		}, CLIENT_HEALTH_RECHECK_MS);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			isCancelled = true;
			window.clearInterval(recheckIntervalId);
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

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
