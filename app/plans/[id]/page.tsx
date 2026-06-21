import Header from "@/components/Header";
import { buttonVariants } from "@/components/ui/button";
import { SharedPlanClient } from "@/features/plans/components/SharedPlanClient";
import {
	getOfficialFetePlanHref,
	isDeprecatedOfficialFeteSourceToken,
} from "@/features/plans/official-plan-config";
import { formatPublicPlanTitle } from "@/features/plans/plan-title";
import {
	buildSharedPlanMetadata,
	getSharedPlanPagePayload,
	resolvePublicPlanIdentifier,
} from "@/features/plans/shared-plan-page.server";
import { cn } from "@/lib/utils";
import { ArrowRight, Route } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const revalidate = 0;

type PlanPageProps = {
	params: Promise<{ id: string }>;
};

export async function generateMetadata({
	params,
}: PlanPageProps): Promise<Metadata> {
	const { id } = await params;
	const resolution = await resolvePublicPlanIdentifier(id);
	if (resolution.kind === "not_found") {
		return {
			title: "Plan not found",
			robots: { index: false, follow: false },
		};
	}
	if (resolution.kind === "redirect") {
		return {
			title: "Plan moved",
			robots: { index: false, follow: true },
		};
	}
	if (resolution.kind === "gone") {
		return {
			title: resolution.title,
			description: resolution.description,
			robots: { index: false, follow: true },
		};
	}

	const isOfficial = resolution.kind === "official";
	const publicPlanTitle = formatPublicPlanTitle(resolution.plan.planDate);
	const description = isOfficial
		? resolution.presentation.description
		: `${publicPlanTitle} with ${resolution.plan.stops.length} stop${
				resolution.plan.stops.length === 1 ? "" : "s"
			}. Save it to your own Fete Finder plans.`;

	return buildSharedPlanMetadata({
		plan: resolution.plan,
		urlPath: resolution.canonicalPath,
		title: isOfficial ? resolution.presentation.title : "A Fête Route",
		description,
		robots: isOfficial
			? { index: true, follow: true }
			: { index: false, follow: true },
	});
}

export default async function PlanPage({ params }: PlanPageProps) {
	const { id } = await params;
	if (isDeprecatedOfficialFeteSourceToken(id)) {
		redirect(getOfficialFetePlanHref());
	}
	const payload = await getSharedPlanPagePayload(id);
	const { resolution } = payload;

	if (resolution.kind === "redirect") {
		redirect(resolution.destination);
	}
	if (resolution.kind === "not_found") notFound();
	if (resolution.kind === "gone") {
		return (
			<div className="ooo-site-shell">
				<Header bannerSettings={payload.bannerSettings} />
				<main
					id="main-content"
					className="min-h-screen bg-background px-4 py-16"
					tabIndex={-1}
				>
					<section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
						<div className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
							<Route className="h-5 w-5" />
						</div>
						<h1 className="mt-5 text-3xl [font-family:var(--ooo-font-display)]">
							{resolution.title}
						</h1>
						<p className="mt-3 text-sm leading-6 text-muted-foreground">
							{resolution.description}
						</p>
						<div className="mt-6 flex flex-wrap gap-2">
							<Link
								href="/plans/fete"
								className={cn(buttonVariants(), "rounded-full")}
							>
								Open current plan
								<ArrowRight className="h-4 w-4" />
							</Link>
							<Link
								href="/plans"
								className={cn(
									buttonVariants({ variant: "outline" }),
									"rounded-full",
								)}
							>
								Open planner
							</Link>
						</div>
					</section>
				</main>
			</div>
		);
	}

	return (
		<div className="ooo-site-shell">
			<Header bannerSettings={payload.bannerSettings} />
			<main
				id="main-content"
				className="min-h-screen bg-background"
				tabIndex={-1}
			>
				<SharedPlanClient
					plan={resolution.plan}
					initialEvents={payload.events}
					presentation={resolution.presentation}
				/>
			</main>
		</div>
	);
}
