"use client";

import React, { createContext, useContext, useState } from "react";

type AuthContextType = {
	isAuthenticated: boolean;
	userEmail: string | null;
	authenticate: (email: string) => void;
	logout: () => Promise<void>;
};

type AuthProviderProps = {
	children: React.ReactNode;
	initialIsAuthenticated?: boolean;
	initialUserEmail?: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

export const AuthProvider = ({
	children,
	initialIsAuthenticated = false,
	initialUserEmail = null,
}: AuthProviderProps) => {
	const [isAuthenticated, setIsAuthenticated] = useState(initialIsAuthenticated);
	const [userEmail, setUserEmail] = useState<string | null>(initialUserEmail);

	const authenticate = (email: string) => {
		if (!isValidEmail(email)) {
			return;
		}
		setUserEmail(email.toLowerCase().trim());
		setIsAuthenticated(true);
	};

	const logout = async () => {
		try {
			await fetch(`${basePath}/api/auth/session`, {
				method: "DELETE",
			});
		} finally {
			setUserEmail(null);
			setIsAuthenticated(false);
		}
	};

	return (
		<AuthContext.Provider
			value={{ isAuthenticated, userEmail, authenticate, logout }}
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
