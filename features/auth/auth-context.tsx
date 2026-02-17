"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type AuthContextType = {
	isAuthenticated: boolean;
	isAdminAuthenticated: boolean;
	isAuthResolved: boolean;
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

const defaultAuthContext: AuthContextType = {
	isAuthenticated: false,
	isAdminAuthenticated: false,
	isAuthResolved: true,
	userEmail: null,
	refreshSession: async () => {},
	authenticate: () => {},
	logout: async () => {},
};

const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
	const [userEmail, setUserEmail] = useState<string | null>(null);
	const [isAuthResolved, setIsAuthResolved] = useState(false);

	const refreshSession = useCallback(async () => {
		try {
			const response = await fetch(`${basePath}/api/auth/session`, {
				method: "GET",
				cache: "no-store",
			});
			if (!response.ok) {
				throw new Error(`Auth session request failed (${response.status})`);
			}

			const payload = (await response.json()) as {
				success: boolean;
				isAuthenticated: boolean;
				isAdminAuthenticated: boolean;
				email: string | null;
			};

			setIsAuthenticated(payload.success && payload.isAuthenticated === true);
			setIsAdminAuthenticated(
				payload.success && payload.isAdminAuthenticated === true,
			);
			setUserEmail(payload.success ? payload.email : null);
		} catch {
			setIsAuthenticated(false);
			setIsAdminAuthenticated(false);
			setUserEmail(null);
		} finally {
			setIsAuthResolved(true);
		}
	}, []);

	useEffect(() => {
		void refreshSession();
	}, [refreshSession]);

	const authenticate = (email: string) => {
		if (!isValidEmail(email)) {
			return;
		}
		setUserEmail(email.toLowerCase().trim());
		setIsAuthenticated(true);
		setIsAuthResolved(true);
	};

	const logout = async () => {
		try {
			await fetch(`${basePath}/api/auth/session`, {
				method: "DELETE",
			});
		} finally {
			setUserEmail(null);
			setIsAuthenticated(false);
			setIsAdminAuthenticated(false);
			setIsAuthResolved(true);
		}
	};

	return (
		<AuthContext.Provider
			value={{
				isAuthenticated,
				isAdminAuthenticated,
				isAuthResolved,
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
