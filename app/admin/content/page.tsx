import {
	getEventLocationReviewData,
	getEventSheetEditorData,
} from "@/features/data-management/actions";
import { getAdminSearchChipSettings } from "@/features/events/search-chip-actions";
import { getEventSubmissionsDashboard } from "@/features/events/submissions/actions";
import { getAdminSlidingBannerSettings } from "@/features/site-settings/actions";
import { getTicketExchangeAdminDashboard } from "@/features/ticket-exchange/admin-actions";
import { getCurrentDeploymentId } from "@/lib/deployment/build-id";
import { unstable_noStore as noStore } from "next/cache";
import { ContentDashboardClient } from "./ContentDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
	noStore();

	const [
		editorData,
		eventSubmissions,
		locationReview,
		searchChipSettings,
		slidingBannerSettings,
		ticketExchangeModeration,
	] = await Promise.allSettled([
		getEventSheetEditorData(),
		getEventSubmissionsDashboard(),
		getEventLocationReviewData(),
		getAdminSearchChipSettings(),
		getAdminSlidingBannerSettings(),
		getTicketExchangeAdminDashboard(),
	]);
	const editorPayload =
		editorData.status === "fulfilled" ? editorData.value : undefined;
	const submissionsPayload =
		eventSubmissions.status === "fulfilled"
			? eventSubmissions.value
			: undefined;
	const ticketExchangePayload =
		ticketExchangeModeration.status === "fulfilled"
			? ticketExchangeModeration.value
			: undefined;
	const pendingEventReviews = submissionsPayload?.success
		? submissionsPayload.pending
				.filter(
					(submission) =>
						submission.payload.submissionType === "event_update" ||
						submission.payload.submissionType === "price_flag",
				)
				.map((submission) => ({
					eventKey: submission.payload.originalEventKey?.trim() ?? "",
					submissionId: submission.id,
					submissionType: submission.payload.submissionType,
				}))
				.filter((review) => review.eventKey.length > 0)
		: [];

	return (
		<ContentDashboardClient
			initialDeploymentId={getCurrentDeploymentId()}
			initialEditorData={editorPayload}
			initialSubmissions={submissionsPayload}
			initialLocationReview={
				locationReview.status === "fulfilled" ? locationReview.value : undefined
			}
			initialSlidingBannerSettings={
				slidingBannerSettings.status === "fulfilled"
					? slidingBannerSettings.value
					: undefined
			}
			initialSearchChipSettings={
				searchChipSettings.status === "fulfilled"
					? searchChipSettings.value
					: undefined
			}
			initialTicketExchangeModeration={ticketExchangePayload}
			pendingEventReviews={pendingEventReviews}
			defaultTab="sheet"
		/>
	);
}
