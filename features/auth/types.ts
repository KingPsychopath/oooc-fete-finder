/**
 * Shared user types for Fête Finder
 * Single source of truth for user-related data structures
 */

export type UserRecord = {
	firstName: string;
	lastName: string;
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
};

export type UserCollectionStoreSummary = {
	provider: "file" | "memory" | "postgres";
	location: string;
	totalUsers: number;
	lastUpdatedAt: string | null;
};

export type UserCollectionSourceSummary = {
	source: string;
	users: number;
	submissions: number;
};

export type UserCollectionAnalytics = {
	totalUsers: number;
	totalSubmissions: number;
	consentedUsers: number;
	nonConsentedUsers: number;
	submissionsLast24Hours: number;
	submissionsLast7Days: number;
	uniqueSources: number;
	topSources: UserCollectionSourceSummary[];
	firstCapturedAt: string | null;
	lastCapturedAt: string | null;
};

export type AuthenticateUserResponse = {
	success: boolean;
	message?: string;
	email?: string;
	error?: string;
};

export type CollectedEmailsResponse = {
	success: boolean;
	emails?: UserRecord[];
	count?: number;
	store?: UserCollectionStoreSummary;
	analytics?: UserCollectionAnalytics;
	error?: string;
};
