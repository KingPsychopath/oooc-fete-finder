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
	error?: string;
};
