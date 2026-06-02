import Header from "@/components/Header";
import { getTicketExchangeSession } from "@/features/ticket-exchange/auth";
import { TicketExchangeShell } from "@/features/ticket-exchange/components/TicketExchangeShell";
import {
	findTicketExchangeEventByKey,
	getTicketExchangeEvents,
	getTicketExchangePageModel,
} from "@/features/ticket-exchange/service";
import { getPublicSlidingBannerSettingsCached } from "@/features/site-settings/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type TicketsEventPageProps = {
	params: Promise<{ eventKey: string }>;
};

export async function generateMetadata({
	params,
}: TicketsEventPageProps): Promise<Metadata> {
	const { eventKey } = await params;
	const events = await getTicketExchangeEvents();
	const event = findTicketExchangeEventByKey(events, eventKey);
	return {
		title: event
			? `${event.name} Tickets | Fete Finder`
			: "Ticket Exchange | Fete Finder",
		description:
			"Find people selling or looking for tickets. OOOC only connects people; trades happen off-platform.",
	};
}

export default async function TicketsEventPage({ params }: TicketsEventPageProps) {
	const { eventKey } = await params;
	const [session, bannerSettings] = await Promise.all([
		getTicketExchangeSession(),
		getPublicSlidingBannerSettingsCached(),
	]);
	const { data, selectedEvent } = await getTicketExchangePageModel({
		session,
		selectedEventKey: eventKey,
	});
	if (!selectedEvent) notFound();

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={bannerSettings} />
			<main id="main-content" className="min-h-screen bg-background" tabIndex={-1}>
				<TicketExchangeShell initialData={data} />
			</main>
		</div>
	);
}
