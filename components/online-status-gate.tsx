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

const readBrowserOnlineStatus = () =>
	typeof navigator === "undefined" || navigator.onLine;

export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
	const [isOnline, setIsOnline] = useState(DEFAULT_ONLINE_STATUS);

	useEffect(() => {
		setIsOnline(readBrowserOnlineStatus());
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				setIsOnline(readBrowserOnlineStatus());
			}
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		window.addEventListener("focus", handleOnline);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
			window.removeEventListener("focus", handleOnline);
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
