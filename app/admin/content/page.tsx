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
import { EventSheetEditorCard } from "../components/EventSheetEditorCard";
import { EventSubmissionsCard } from "../components/EventSubmissionsCard";
import { LocationReviewCard } from "../components/LocationReviewCard";
import { SearchChipSettingsCard } from "../components/SearchChipSettingsCard";
import { SlidingBannerSettingsCard } from "../components/SlidingBannerSettingsCard";
import { TicketExchangeModerationCard } from "../components/TicketExchangeModerationCard";

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
	const hasPendingSubmissions = Boolean(
		submissionsPayload?.success && submissionsPayload.pending.length > 0,
	);
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
	const eventSubmissionsSection = (
		<section id="event-submissions" className="scroll-mt-44">
			<EventSubmissionsCard initialPayload={submissionsPayload} />
		</section>
	);
	const eventSheetEditorSection = (
		<section id="event-sheet-editor" className="scroll-mt-44">
			<EventSheetEditorCard
				isAuthenticated
				initialDeploymentId={getCurrentDeploymentId()}
				initialEditorData={editorPayload}
				pendingEventReviews={pendingEventReviews}
			/>
		</section>
	);

	return (
		<div className="space-y-6">
			{hasPendingSubmissions
				? eventSubmissionsSection
				: eventSheetEditorSection}
			{hasPendingSubmissions
				? eventSheetEditorSection
				: eventSubmissionsSection}

			<section id="ticket-exchange-moderation" className="scroll-mt-44">
				<TicketExchangeModerationCard
					initialPayload={
						ticketExchangeModeration.status === "fulfilled"
							? ticketExchangeModeration.value
							: undefined
					}
				/>
			</section>

			<section id="location-review" className="scroll-mt-44">
				<LocationReviewCard
					initialPayload={
						locationReview.status === "fulfilled"
							? locationReview.value
							: undefined
					}
				/>
			</section>

			<section id="sliding-banner" className="scroll-mt-44">
				<SlidingBannerSettingsCard
					initialSettings={
						slidingBannerSettings.status === "fulfilled"
							? slidingBannerSettings.value
							: undefined
					}
				/>
			</section>

			<section id="search-chips" className="scroll-mt-44">
				<SearchChipSettingsCard
					initialSettings={
						searchChipSettings.status === "fulfilled"
							? searchChipSettings.value
							: undefined
					}
				/>
			</section>
		</div>
	);
}
