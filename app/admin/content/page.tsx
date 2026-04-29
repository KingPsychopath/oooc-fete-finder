import {
	getEventLocationReviewData,
	getEventSheetEditorData,
} from "@/features/data-management/actions";
import { getEventSubmissionsDashboard } from "@/features/events/submissions/actions";
import { getAdminSlidingBannerSettings } from "@/features/site-settings/actions";
import { getCurrentDeploymentId } from "@/lib/deployment/build-id";
import { unstable_noStore as noStore } from "next/cache";
import { EventSheetEditorCard } from "../components/EventSheetEditorCard";
import { EventSubmissionsCard } from "../components/EventSubmissionsCard";
import { LocationReviewCard } from "../components/LocationReviewCard";
import { SlidingBannerSettingsCard } from "../components/SlidingBannerSettingsCard";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
	noStore();

	const [editorData, eventSubmissions, locationReview, slidingBannerSettings] =
		await Promise.allSettled([
			getEventSheetEditorData(),
			getEventSubmissionsDashboard(),
			getEventLocationReviewData(),
			getAdminSlidingBannerSettings(),
		]);

	return (
		<div className="space-y-6">
			<section id="event-sheet-editor" className="scroll-mt-44">
				<EventSheetEditorCard
					isAuthenticated
					initialDeploymentId={getCurrentDeploymentId()}
					initialEditorData={
						editorData.status === "fulfilled" ? editorData.value : undefined
					}
				/>
			</section>

			<section id="event-submissions" className="scroll-mt-44">
				<EventSubmissionsCard
					initialPayload={
						eventSubmissions.status === "fulfilled"
							? eventSubmissions.value
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
		</div>
	);
}
