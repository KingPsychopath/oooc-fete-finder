import Header from "@/components/Header";
import { getTicketExchangeSession } from "@/features/ticket-exchange/auth";
import { TicketExchangeShell } from "@/features/ticket-exchange/components/TicketExchangeShell";
import { getTicketExchangePageModel } from "@/features/ticket-exchange/service";
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
	const { data } = await getTicketExchangePageModel({
		session,
	});

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={bannerSettings} />
			<main id="main-content" className="min-h-screen bg-background" tabIndex={-1}>
				<TicketExchangeShell initialData={data} />
			</main>
		</div>
	);
}
