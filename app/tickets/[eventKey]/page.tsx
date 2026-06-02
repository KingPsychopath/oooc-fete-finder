import { redirect } from "next/navigation";

type TicketsEventRedirectPageProps = {
	params: Promise<{ eventKey: string }>;
};

export default async function TicketsEventRedirectPage({
	params,
}: TicketsEventRedirectPageProps) {
	const { eventKey } = await params;
	redirect(`/exchange/${encodeURIComponent(eventKey)}`);
}
