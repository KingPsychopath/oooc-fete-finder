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

const readBrowserOnlineStatus = () =>
	typeof navigator === "undefined" || navigator.onLine;

export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
	const [isOnline, setIsOnline] = useState(true);

	const refreshOnlineStatus = useCallback(() => {
		setIsOnline(readBrowserOnlineStatus());
	}, []);

	useEffect(() => {
		refreshOnlineStatus();

		const handleOnline = () => setIsOnline(true);
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
