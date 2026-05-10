/**
 * Shared user types for Fête Finder
 * Single source of truth for user-related data structures
 */

export type UserRecord = {
	userId?: string;
	firstName: string;
	lastName: string;
	email: string;
	timestamp: string;
	firstSignInAt?: string;
	consent: boolean;
	source: string;
	deviceClass?: string | null;
	platform?: string | null;
	browserFamily?: string | null;
	timezone?: string | null;
	locale?: string | null;
	linkedSignalCount?: number;
	searchSignalCount?: number;
	filterSignalCount?: number;
	eventActionSignalCount?: number;
	genrePreferenceSignalCount?: number;
	lastSignalAt?: string | null;
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

export type UserContextSummary = {
	label: string;
	users: number;
};

export type CollectedUserProfile = {
	user: UserRecord;
	recentTourInteractions: Array<{
		action: string;
		stepId: string | null;
		source: string | null;
		recordedAt: string;
	}>;
	genrePreferences: Array<{
		genre: string;
		score: number;
		lastSeenAt: string;
	}>;
	recentSearches: Array<{
		query: string;
		recordedAt: string;
	}>;
	recentFilters: Array<{
		filterGroup: string;
		filterValue: string;
		recordedAt: string;
	}>;
	recentEventActions: Array<{
		eventKey: string;
		eventName: string | null;
		eventHref: string | null;
		actionType: string;
		source: string | null;
		recordedAt: string;
	}>;
};

export type UserCollectionAnalytics = {
	totalUsers: number;
	totalSubmissions: number;
	consentedUsers: number;
	nonConsentedUsers: number;
	submissionsLast24Hours: number;
	submissionsLast7Days: number;
	linkedBehaviorUsers: number;
	uniqueSources: number;
	topSources: UserCollectionSourceSummary[];
	topDeviceClasses: UserContextSummary[];
	topPlatforms: UserContextSummary[];
	topBrowserFamilies: UserContextSummary[];
	topTimezones: UserContextSummary[];
	topLocales: UserContextSummary[];
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

export type CollectedUserProfileResponse = {
	success: boolean;
	profile?: CollectedUserProfile;
	error?: string;
};
