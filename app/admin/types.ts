import type {
	getAdminSessionStatus,
	getAdminTokenSessions,
} from "@/features/auth/actions";
import type { CollectedEmailsResponse } from "@/features/auth/types";
import type {
	getEventSheetEditorData,
	getLiveSiteEventsSnapshot,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
} from "@/features/data-management/actions";
import type { getAdminSlidingBannerSettings } from "@/features/site-settings/actions";
import type { RuntimeDataStatus } from "@/features/data-management/runtime-service";

export type {
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
	UserRecord as EmailRecord,
} from "@/features/auth/types";
export type { RuntimeDataStatus } from "@/features/data-management/runtime-service";

/** Payload passed from server admin page to AdminDashboardClient for first-paint data */
export type AdminInitialData = {
	runtimeDataStatus: RuntimeDataStatus;
	emailsResult?: CollectedEmailsResponse;
	sessionStatus: Awaited<ReturnType<typeof getAdminSessionStatus>>;
	tokenSessions?: Awaited<ReturnType<typeof getAdminTokenSessions>>;
	localStoreStatus?: Awaited<ReturnType<typeof getLocalEventStoreStatus>>;
	localStorePreview?: Awaited<ReturnType<typeof getLocalEventStorePreview>>;
	editorData?: Awaited<ReturnType<typeof getEventSheetEditorData>>;
	liveSnapshot?: Awaited<ReturnType<typeof getLiveSiteEventsSnapshot>>;
	slidingBannerSettings?: Awaited<
		ReturnType<typeof getAdminSlidingBannerSettings>
	>;
};
