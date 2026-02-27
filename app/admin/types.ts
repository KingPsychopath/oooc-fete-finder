import type {
	getAdminSessionStatus,
	getAdminTokenSessions,
} from "@/features/auth/actions";
import type { CollectedEmailsResponse } from "@/features/auth/types";
import type {
	getEventSheetEditorData,
	getEventStoreBackupStatus,
	getEventStoreRecentBackups,
	getLiveSiteEventsSnapshot,
	getLocalEventStorePreview,
	getLocalEventStoreStatus,
} from "@/features/data-management/actions";
import type { RuntimeDataStatus } from "@/features/data-management/runtime-service";
import type { listFeaturedQueue } from "@/features/events/featured/actions";
import type { listPromotedQueue } from "@/features/events/promoted/actions";
import type { getEventSubmissionsDashboard } from "@/features/events/submissions/actions";
import type { getPartnerActivationDashboard } from "@/features/partners/activation-actions";
import type { getAdminSlidingBannerSettings } from "@/features/site-settings/actions";

export type {
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
	UserRecord as EmailRecord,
} from "@/features/auth/types";
export type { RuntimeDataStatus } from "@/features/data-management/runtime-service";

/** Payload passed from server admin page to AdminDashboardClient for first-paint data */
export type AdminInitialData = {
	runtimeDataStatus?: RuntimeDataStatus;
	emailsResult?: CollectedEmailsResponse;
	sessionStatus: Awaited<ReturnType<typeof getAdminSessionStatus>>;
	tokenSessions?: Awaited<ReturnType<typeof getAdminTokenSessions>>;
	localStoreStatus?: Awaited<ReturnType<typeof getLocalEventStoreStatus>>;
	localStorePreview?: Awaited<ReturnType<typeof getLocalEventStorePreview>>;
	localBackupStatus?: Awaited<ReturnType<typeof getEventStoreBackupStatus>>;
	localRecentBackups?: Awaited<ReturnType<typeof getEventStoreRecentBackups>>;
	editorData?: Awaited<ReturnType<typeof getEventSheetEditorData>>;
	liveSnapshot?: Awaited<ReturnType<typeof getLiveSiteEventsSnapshot>>;
	featuredQueue?: Awaited<ReturnType<typeof listFeaturedQueue>>;
	promotedQueue?: Awaited<ReturnType<typeof listPromotedQueue>>;
	partnerActivations?: Awaited<
		ReturnType<typeof getPartnerActivationDashboard>
	>;
	eventSubmissions?: Awaited<ReturnType<typeof getEventSubmissionsDashboard>>;
	slidingBannerSettings?: Awaited<
		ReturnType<typeof getAdminSlidingBannerSettings>
	>;
};
