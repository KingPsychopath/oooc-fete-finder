// Import shared user types
export type { UserRecord as EmailRecord } from "@/types/user";

export type CacheStatus = {
	hasCachedData: boolean;
	lastFetchTime: string | null;
	lastRemoteFetchTime: string | null;
	lastRemoteSuccessTime: string | null;
	lastRemoteErrorMessage: string;
	cacheAge: number;
	nextRemoteCheck: number;
	dataSource: "remote" | "local" | "cached";
	configuredDataSource: "remote" | "local" | "static";
	eventCount: number;
	localCsvLastUpdated: string;
	remoteConfigured: boolean;
};

export type DynamicSheetConfig = {
	hasDynamicOverride: boolean;
	sheetId: string | null;
	range: string | null;
	envSheetId: string | null;
	envRange: string | null;
};
