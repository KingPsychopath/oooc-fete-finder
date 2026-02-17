import type { getAdminSessionStatus, getAdminTokenSessions } from "@/features/auth/actions";
import type { CollectedEmailsResponse } from "@/features/auth/types";
import type {
	getEventSheetEditorData,
	getLiveSiteEventsSnapshot,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
} from "@/features/data-management/actions";
import type { CacheStatus } from "@/lib/cache/cache-types";

export type {
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
	UserRecord as EmailRecord,
} from "@/features/auth/types";
export type { CacheStatus } from "@/lib/cache/cache-types";

export type DynamicSheetConfig = {
	hasDynamicOverride: boolean;
	sheetId: string | null;
	range: string | null;
	envSheetId: string | null;
	envRange: string | null;
};

/** Payload passed from server admin page to AdminDashboardClient for first-paint data */
export type AdminInitialData = {
	cacheStatus: CacheStatus;
	emailsResult: CollectedEmailsResponse;
	sessionStatus: Awaited<ReturnType<typeof getAdminSessionStatus>>;
	tokenSessions: Awaited<ReturnType<typeof getAdminTokenSessions>>;
	localStoreStatus: Awaited<ReturnType<typeof getLocalEventStoreStatus>>;
	localStorePreview: Awaited<ReturnType<typeof getLocalEventStorePreview>>;
	editorData: Awaited<ReturnType<typeof getEventSheetEditorData>>;
	liveSnapshot: Awaited<ReturnType<typeof getLiveSiteEventsSnapshot>>;
};
