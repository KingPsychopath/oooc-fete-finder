import { listFeaturedQueue } from "@/features/events/featured/actions";
import { listPromotedQueue } from "@/features/events/promoted/actions";
import { getPartnerActivationDashboard } from "@/features/partners/activation-actions";
import { unstable_noStore as noStore } from "next/cache";
import { FeaturedEventsManagerCard } from "../components/FeaturedEventsManagerCard";
import { PartnerActivationQueueCard } from "../components/PartnerActivationQueueCard";

export const dynamic = "force-dynamic";

export default async function AdminPlacementsPage() {
	noStore();

	const [partnerActivations, featuredQueue, promotedQueue] =
		await Promise.allSettled([
			getPartnerActivationDashboard(),
			listFeaturedQueue(),
			listPromotedQueue(),
		]);

	return (
		<div className="space-y-6">
			<section id="paid-orders-inbox" className="scroll-mt-44">
				<PartnerActivationQueueCard
					initialPayload={
						partnerActivations.status === "fulfilled"
							? partnerActivations.value
							: undefined
					}
				/>
			</section>

			<section id="featured-events-manager" className="scroll-mt-44">
				<FeaturedEventsManagerCard
					initialPayload={
						featuredQueue.status === "fulfilled"
							? featuredQueue.value
							: undefined
					}
					initialPromotedPayload={
						promotedQueue.status === "fulfilled"
							? promotedQueue.value
							: undefined
					}
				/>
			</section>
		</div>
	);
}
