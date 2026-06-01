import Header from "@/components/Header";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { toHomepageEventPayload } from "@/features/events/homepage-event-payload";
import { PlansClient } from "@/features/plans/components/PlansClient";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";

export const revalidate = false;

export default async function PlansPage() {
	const [result, bannerSettings] = await Promise.all([
		getLiveEvents({ includeEngagementProjection: true }),
		getPublicSlidingBannerSettingsCached(),
	]);
	const events = result.data.map(toHomepageEventPayload);

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={bannerSettings} />
			<main
				id="main-content"
				className="min-h-screen bg-background"
				tabIndex={-1}
			>
				<PlansClient initialEvents={events} />
			</main>
		</div>
	);
}
