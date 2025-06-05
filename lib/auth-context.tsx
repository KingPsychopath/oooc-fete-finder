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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [userEmail, setUserEmail] = useState<string | null>(null);

	// Check for existing authentication on mount
	useEffect(() => {
		const storedData = localStorage.getItem(AUTH_STORAGE_KEY);
		if (storedData) {
			try {
				// Try parsing as JSON (new format with expiry)
				const parsed = JSON.parse(storedData);
				if (parsed.email && parsed.expires) {
					// Check if expired
					if (new Date().getTime() < parsed.expires) {
						setUserEmail(parsed.email);
						setIsAuthenticated(true);
					} else {
						// Expired, clear storage
						localStorage.removeItem(AUTH_STORAGE_KEY);
					}
				} else if (parsed.email) {
					// Old format without expiry, migrate
					setUserEmail(parsed.email);
					setIsAuthenticated(true);
				}
			} catch {
				// Fallback: treat as plain email string (backward compatibility)
				setUserEmail(storedData);
				setIsAuthenticated(true);
			}
		}
	}, []);

	const authenticate = (email: string) => {
		// Store with 30-day expiry (optional - you can disable this)
		const EXPIRY_DAYS = 30;
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS);
		
		const authData = {
			email,
			expires: expiryDate.getTime(),
			timestamp: new Date().toISOString()
		};
		
		localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
		setUserEmail(email);
		setIsAuthenticated(true);
		
		// Optional: Send email to your backend here
		console.log("User authenticated with email:", email);
	};

	const logout = () => {
		localStorage.removeItem(AUTH_STORAGE_KEY);
		setUserEmail(null);
		setIsAuthenticated(false);
	};

	return (
		<AuthContext.Provider value={{ isAuthenticated, userEmail, authenticate, logout }}>
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