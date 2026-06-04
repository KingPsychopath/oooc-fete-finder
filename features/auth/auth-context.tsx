"use client";

import { useOnlineStatus } from "@/components/online-status-gate";
import {
	type OfflineGraceState,
	createOfflineGraceState,
	isOfflineGraceActive,
	parseOfflineGraceState,
} from "@/features/auth/offline-grace";
import { clientLog } from "@/lib/platform/client-logger";
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type AuthMode = "signed-out" | "live" | "offline-grace";

type AuthContextType = {
	isAuthenticated: boolean;
	isAdminAuthenticated: boolean;
	isAuthResolved: boolean;
	isOnline: boolean;
	authMode: AuthMode;
	canUseProtectedDiscovery: boolean;
	offlineGraceExpiresAt: number | null;
	userEmail: string | null;
	userId: string | null;
	refreshSession: () => Promise<boolean>;
	logout: () => Promise<void>;
};

type AuthProviderProps = {
	children: React.ReactNode;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const OFFLINE_GRACE_STORAGE_KEY = "oooc_offline_auth_grace_v1";
const AUTH_TIMING_LOG_ENABLED =
	process.env.NODE_ENV === "development" ||
	process.env.NEXT_PUBLIC_AUTH_TIMING_LOG === "1";
const isBrowserOnline = (): boolean =>
	typeof navigator === "undefined" || navigator.onLine;

const defaultAuthContext: AuthContextType = {
	isAuthenticated: false,
	isAdminAuthenticated: false,
	isAuthResolved: true,
	isOnline: true,
	authMode: "signed-out",
	canUseProtectedDiscovery: false,
	offlineGraceExpiresAt: null,
	userEmail: null,
	userId: null,
	refreshSession: async () => false,
	logout: async () => {},
};

const readOfflineGraceState = (): OfflineGraceState | null => {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(OFFLINE_GRACE_STORAGE_KEY);
	return parseOfflineGraceState(raw);
};

const writeOfflineGraceState = (userId: string, expiresAt: number): void => {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		OFFLINE_GRACE_STORAGE_KEY,
		JSON.stringify({
			userId: userId.trim(),
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
	const [userId, setUserId] = useState<string | null>(null);
	const [isAuthResolved, setIsAuthResolved] = useState(false);
	const isOnline = useOnlineStatus();
	const [authMode, setAuthMode] = useState<AuthMode>("signed-out");
	const [offlineGraceExpiresAt, setOfflineGraceExpiresAt] = useState<
		number | null
	>(null);

	const setSignedOutState = useCallback(() => {
		setIsAuthenticated(false);
		setUserEmail(null);
		setUserId(null);
		setAuthMode("signed-out");
		setOfflineGraceExpiresAt(null);
	}, []);

	const setLiveAuthenticatedState = useCallback(
		(input: { email: string; userId: string | null }) => {
			const normalizedEmail = input.email.trim().toLowerCase();
			const normalizedUserId = input.userId?.trim() || null;
			setIsAuthenticated(true);
			setUserEmail(normalizedEmail);
			setUserId(normalizedUserId);
			setAuthMode("live");
			if (!normalizedUserId) {
				clearOfflineGraceState();
				setOfflineGraceExpiresAt(null);
				return;
			}
			const graceState = createOfflineGraceState(normalizedUserId);
			setOfflineGraceExpiresAt(graceState.expiresAt);
			writeOfflineGraceState(graceState.userId, graceState.expiresAt);
		},
		[],
	);

	const tryApplyOfflineGraceState = useCallback((): boolean => {
		const graceState = readOfflineGraceState();
		if (!graceState) return false;

		if (!isOfflineGraceActive(graceState)) {
			clearOfflineGraceState();
			return false;
		}

		setIsAuthenticated(true);
		setUserEmail(null);
		setUserId(graceState.userId);
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
				userId: string | null;
			};

			const hasLiveAuth =
				payload.success &&
				payload.isAuthenticated === true &&
				typeof payload.email === "string" &&
				payload.email.trim().length > 0;
			const hasAdminAuth =
				payload.success && payload.isAdminAuthenticated === true;
			setIsAdminAuthenticated(hasAdminAuth);

			if (hasLiveAuth) {
				outcome = "live";
				setLiveAuthenticatedState({
					email: payload.email as string,
					userId: typeof payload.userId === "string" ? payload.userId : null,
				});
				return true;
			}

			if (hasAdminAuth) {
				outcome = "signed-out";
				clearOfflineGraceState();
				setSignedOutState();
				return false;
			}

			if (!isOnline || !isBrowserOnline()) {
				const canUseOfflineGrace = tryApplyOfflineGraceState();
				if (canUseOfflineGrace) {
					outcome = "offline-grace";
					return true;
				}
			}

			outcome = "signed-out";
			clearOfflineGraceState();
			setSignedOutState();
			return false;
		} catch {
			// If we cannot verify the admin session, hide admin-only UI until
			// connectivity/session checks recover. Network-level failures keep
			// previously verified users in offline grace instead of clearing it.
			setIsAdminAuthenticated(false);
			if (!isOnline || !isBrowserOnline() || statusCode === null) {
				const canUseOfflineGrace = tryApplyOfflineGraceState();
				if (canUseOfflineGrace) {
					outcome = "offline-grace";
					return true;
				}
			}
			if (authMode === "live" && isAuthenticated) {
				outcome = "live";
				return true;
			}
			clearOfflineGraceState();
			if (authMode === "offline-grace") {
				setSignedOutState();
			}
			outcome = "error";
			return false;
		} finally {
			if (AUTH_TIMING_LOG_ENABLED) {
				const endTimeMs =
					typeof performance !== "undefined" ? performance.now() : Date.now();
				clientLog.info("auth", "Session refresh timing", {
					durationMs: Math.round(endTimeMs - startTimeMs),
					statusCode,
					outcome,
					isOnline,
				});
			}
			setIsAuthResolved(true);
		}
	}, [
		authMode,
		isAuthenticated,
		isOnline,
		setLiveAuthenticatedState,
		setSignedOutState,
		tryApplyOfflineGraceState,
	]);

	useEffect(() => {
		if (isOnline) {
			void refreshSession();
			return;
		}

		setIsAdminAuthenticated(false);
		if (!tryApplyOfflineGraceState()) {
			setSignedOutState();
		}
		setIsAuthResolved(true);
	}, [isOnline, refreshSession, setSignedOutState, tryApplyOfflineGraceState]);

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
	const canUseProtectedDiscovery =
		isAuthenticated && (authMode === "live" || authMode === "offline-grace");

	return (
		<AuthContext.Provider
			value={{
				isAuthenticated,
				isAdminAuthenticated,
				isAuthResolved,
				isOnline,
				authMode,
				canUseProtectedDiscovery,
				offlineGraceExpiresAt,
				userEmail,
				userId,
				refreshSession,
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
