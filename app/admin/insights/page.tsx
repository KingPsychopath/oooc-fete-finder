import { getCollectedEmails } from "@/features/auth/actions";
import { getEventEngagementDashboard } from "@/features/events/engagement/actions";
import { unstable_noStore as noStore } from "next/cache";
import type { AdminInsightsInitialData } from "../types";
import { InsightsDashboardClient } from "./InsightsDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminInsightsPage() {
	noStore();

	const [eventEngagementDashboard, emailsResult] = await Promise.allSettled([
		getEventEngagementDashboard(30),
		getCollectedEmails(),
	]);

	const initialData: AdminInsightsInitialData = {
		eventEngagementDashboard:
			eventEngagementDashboard.status === "fulfilled"
				? eventEngagementDashboard.value
				: undefined,
		emailsResult:
			emailsResult.status === "fulfilled" ? emailsResult.value : undefined,
	};

	return <InsightsDashboardClient initialData={initialData} />;
}
