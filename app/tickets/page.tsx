import Header from "@/components/Header";
import { getSpotlightRotationContext } from "@/features/events/featured/selection";
import { getDefaultDateRangeForEvents } from "@/features/events/filtering";
import { getTicketExchangeSession } from "@/features/ticket-exchange/auth";
import { TicketExchangeShell } from "@/features/ticket-exchange/components/TicketExchangeShell";
import { getTicketExchangePageData } from "@/features/ticket-exchange/service";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Ticket Exchange | Fete Finder",
	description:
		"Find people selling or looking for tickets linked to Fete Finder events. OOOC only connects people; trades happen off-platform.",
};

export default async function TicketsPage() {
	const [session, bannerSettings] = await Promise.all([
		getTicketExchangeSession(),
		getPublicSlidingBannerSettingsCached(),
	]);
	const data = await getTicketExchangePageData({
		userId: session.userId,
		userEmail: session.email,
	});
	const spotlightRotationContext = getSpotlightRotationContext({
		dateRange: getDefaultDateRangeForEvents(data.events),
	});

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={bannerSettings} />
			<main id="main-content" className="min-h-screen bg-background" tabIndex={-1}>
				<TicketExchangeShell
					initialData={data}
					spotlightRotationContext={spotlightRotationContext}
				/>
			</main>
		</div>
	);
}
