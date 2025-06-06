export type EmailRecord = {
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
};

export type CacheStatus = {
	hasCachedData: boolean;
	lastFetchTime: string | null;
	lastRemoteFetchTime: string | null;
	lastRemoteSuccessTime: string | null;
	lastRemoteErrorMessage: string;
	cacheAge: number;
	nextRemoteCheck: number;
	dataSource: "remote" | "local" | "cached";
	useCsvData: boolean;
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
