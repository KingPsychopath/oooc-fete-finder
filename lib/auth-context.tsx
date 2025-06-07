"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type AuthContextType = {
	isAuthenticated: boolean;
	userEmail: string | null;
	authenticate: (email: string) => void;
	logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "fete_finder_user_email";

// Validate email format
const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [userEmail, setUserEmail] = useState<string | null>(null);

	// Check for existing authentication on mount
	useEffect(() => {
		const storedData = localStorage.getItem(AUTH_STORAGE_KEY);
		if (storedData) {
			try {
				const parsed = JSON.parse(storedData);

				if (parsed.email && parsed.expires && parsed.timestamp) {
					// Validate email format
					if (!isValidEmail(parsed.email)) {
						localStorage.removeItem(AUTH_STORAGE_KEY);
						return;
					}

					// Check if expired
					if (new Date().getTime() < parsed.expires) {
						setUserEmail(parsed.email);
						setIsAuthenticated(true);
					} else {
						// Expired, clear storage
						localStorage.removeItem(AUTH_STORAGE_KEY);
					}
				} else if (parsed.email) {
					// Old format without expiry, validate and keep
					if (isValidEmail(parsed.email)) {
						setUserEmail(parsed.email);
						setIsAuthenticated(true);
					} else {
						localStorage.removeItem(AUTH_STORAGE_KEY);
					}
				}
			} catch {
				// Fallback: treat as plain email string (backward compatibility)
				if (isValidEmail(storedData)) {
					setUserEmail(storedData);
					setIsAuthenticated(true);
				} else {
					localStorage.removeItem(AUTH_STORAGE_KEY);
				}
			}
		}
	}, []);

	const authenticate = (email: string) => {
		// Validate email before storing
		if (!isValidEmail(email)) {
			console.error("Invalid email format provided to authenticate");
			return;
		}

		// Store with configurable expiry (default 30 days)
		const EXPIRY_DAYS = parseInt(
			process.env.NEXT_PUBLIC_AUTH_EXPIRY_DAYS || "30",
		);
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS);

		const authData = {
			email: email.toLowerCase().trim(), // Normalize email
			expires: expiryDate.getTime(),
			timestamp: new Date().toISOString(),
			version: "2.0", // Version for future migrations
		};

		// Store as plain JSON - simpler and more debuggable
		localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));

		setUserEmail(email.toLowerCase().trim());
		setIsAuthenticated(true);

		console.log("User authenticated with email:", email);
	};

	const logout = () => {
		localStorage.removeItem(AUTH_STORAGE_KEY);
		setUserEmail(null);
		setIsAuthenticated(false);
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
