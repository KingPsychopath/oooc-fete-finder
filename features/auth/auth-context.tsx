"use client";

import { clientLog } from "@/lib/platform/client-logger";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type AuthMode = "signed-out" | "live" | "offline-grace";

type OfflineGraceState = {
	email: string;
	expiresAt: number;
};

type AuthContextType = {
	isAuthenticated: boolean;
	isAdminAuthenticated: boolean;
	isAuthResolved: boolean;
	isOnline: boolean;
	authMode: AuthMode;
	offlineGraceExpiresAt: number | null;
	userEmail: string | null;
	refreshSession: () => Promise<void>;
	authenticate: (email: string) => void;
	logout: () => Promise<void>;
};

type AuthProviderProps = {
	children: React.ReactNode;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const OFFLINE_GRACE_STORAGE_KEY = "oooc_offline_auth_grace_v1";
const OFFLINE_GRACE_WINDOW_MS = 72 * 60 * 60 * 1000;
const AUTH_TIMING_LOG_ENABLED =
	process.env.NODE_ENV === "development" ||
	process.env.NEXT_PUBLIC_AUTH_TIMING_LOG === "1";

const defaultAuthContext: AuthContextType = {
	isAuthenticated: false,
	isAdminAuthenticated: false,
	isAuthResolved: true,
	isOnline: true,
	authMode: "signed-out",
	offlineGraceExpiresAt: null,
	userEmail: null,
	refreshSession: async () => {},
	authenticate: () => {},
	logout: async () => {},
};

const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

const readOfflineGraceState = (): OfflineGraceState | null => {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(OFFLINE_GRACE_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<OfflineGraceState>;
		if (
			typeof parsed.email !== "string" ||
			typeof parsed.expiresAt !== "number" ||
			parsed.email.trim().length === 0
		) {
			return null;
		}
		return {
			email: parsed.email.trim().toLowerCase(),
			expiresAt: parsed.expiresAt,
		};
	} catch {
		return null;
	}
};

const writeOfflineGraceState = (email: string, expiresAt: number): void => {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		OFFLINE_GRACE_STORAGE_KEY,
		JSON.stringify({
			email: email.trim().toLowerCase(),
			expiresAt,
		}),
	);
};

const clearOfflineGraceState = (): void => {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem(OFFLINE_GRACE_STORAGE_KEY);
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
	const [userEmail, setUserEmail] = useState<string | null>(null);
	const [isAuthResolved, setIsAuthResolved] = useState(false);
	const [isOnline, setIsOnline] = useState(true);
	const [authMode, setAuthMode] = useState<AuthMode>("signed-out");
	const [offlineGraceExpiresAt, setOfflineGraceExpiresAt] = useState<
		number | null
	>(null);

	const setSignedOutState = useCallback(() => {
		setIsAuthenticated(false);
		setIsAdminAuthenticated(false);
		setUserEmail(null);
		setAuthMode("signed-out");
		setOfflineGraceExpiresAt(null);
	}, []);

	const setLiveAuthenticatedState = useCallback(
		(email: string, isAdmin: boolean) => {
			const normalizedEmail = email.trim().toLowerCase();
			const expiresAt = Date.now() + OFFLINE_GRACE_WINDOW_MS;
			setIsAuthenticated(true);
			setIsAdminAuthenticated(isAdmin);
			setUserEmail(normalizedEmail);
			setAuthMode("live");
			setOfflineGraceExpiresAt(expiresAt);
			writeOfflineGraceState(normalizedEmail, expiresAt);
		},
		[],
	);

	const tryApplyOfflineGraceState = useCallback((): boolean => {
		const graceState = readOfflineGraceState();
		if (!graceState) return false;

		if (graceState.expiresAt <= Date.now()) {
			clearOfflineGraceState();
			return false;
		}

		setIsAuthenticated(true);
		setIsAdminAuthenticated(false);
		setUserEmail(graceState.email);
		setAuthMode("offline-grace");
		setOfflineGraceExpiresAt(graceState.expiresAt);
		return true;
	}, []);

	const refreshSession = useCallback(async () => {
		const startTimeMs =
			typeof performance !== "undefined" ? performance.now() : Date.now();
		let statusCode: number | null = null;
		let outcome: "live" | "signed-out" | "offline-grace" | "error" = "error";

		try {
			const response = await fetch(`${basePath}/api/auth/session`, {
				method: "GET",
				cache: "no-store",
			});
			statusCode = response.status;
			if (!response.ok) {
				throw new Error(`Auth session request failed (${response.status})`);
			}

			const payload = (await response.json()) as {
				success: boolean;
				isAuthenticated: boolean;
				isAdminAuthenticated: boolean;
				email: string | null;
			};

			const hasLiveAuth =
				payload.success &&
				payload.isAuthenticated === true &&
				typeof payload.email === "string" &&
				payload.email.trim().length > 0;

			if (hasLiveAuth) {
				outcome = "live";
				setLiveAuthenticatedState(
					payload.email as string,
					payload.success && payload.isAdminAuthenticated === true,
				);
			} else {
				outcome = "signed-out";
				clearOfflineGraceState();
				setSignedOutState();
			}
		} catch {
			const canUseOfflineGrace =
				typeof navigator !== "undefined" &&
				navigator.onLine === false &&
				tryApplyOfflineGraceState();
			if (!canUseOfflineGrace) {
				outcome = "signed-out";
				setSignedOutState();
			} else {
				outcome = "offline-grace";
			}
		} finally {
			if (AUTH_TIMING_LOG_ENABLED) {
				const endTimeMs =
					typeof performance !== "undefined" ? performance.now() : Date.now();
				clientLog.info("auth", "Session refresh timing", {
					durationMs: Math.round(endTimeMs - startTimeMs),
					statusCode,
					outcome,
					isOnline: typeof navigator !== "undefined" ? navigator.onLine : null,
				});
			}
			setIsAuthResolved(true);
		}
	}, [setLiveAuthenticatedState, setSignedOutState, tryApplyOfflineGraceState]);

	useEffect(() => {
		void refreshSession();
	}, [refreshSession]);

	useEffect(() => {
		if (typeof navigator === "undefined") return;
		setIsOnline(navigator.onLine);

		const handleOnline = () => {
			setIsOnline(true);
			void refreshSession();
		};

		const handleOffline = () => {
			setIsOnline(false);
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [refreshSession]);

	const authenticate = (email: string) => {
		if (!isValidEmail(email)) {
			return;
		}
		setLiveAuthenticatedState(email, false);
		setIsAuthResolved(true);
	};

	const logout = async () => {
		try {
			await fetch(`${basePath}/api/auth/session`, {
				method: "DELETE",
			});
		} finally {
			clearOfflineGraceState();
			setSignedOutState();
			setIsAuthResolved(true);
		}
	};

	return (
		<AuthContext.Provider
			value={{
				isAuthenticated,
				isAdminAuthenticated,
				isAuthResolved,
				isOnline,
				authMode,
				offlineGraceExpiresAt,
				userEmail,
				refreshSession,
				authenticate,
				logout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

export const useOptionalAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	return context ?? defaultAuthContext;
};
