import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { getPartnerStatsSnapshot } from "@/features/partners/partner-stats";
import {
	generateOGImageUrl,
	generateOGMetadata,
} from "@/lib/social/og-utils";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const metadata: Metadata = generateOGMetadata({
	title: "Partner Performance Report | OOOC Fete Finder",
	description:
		"Private partner performance metrics for OOOC campaign placements.",
	ogImageUrl: generateOGImageUrl({
		title: "Partner Performance Report",
		subtitle: "Private campaign performance metrics",
		variant: "default",
	}),
	url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${basePath || ""}/partner-stats`,
	noIndex: true,
});

export const dynamic = "force-dynamic";

const PartnerMetricCard = ({
	label,
	value,
	description,
}: {
	label: string;
	value: string | number;
	description: string;
}) => (
	<Card className="border-border/80 bg-card">
		<CardHeader className="pb-2">
			<CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
				{label}
			</CardTitle>
			<CardDescription className="text-[11px] leading-snug">
				{description}
			</CardDescription>
		</CardHeader>
		<CardContent className="pt-0 text-2xl font-medium tabular-nums">
			{value}
		</CardContent>
	</Card>
);

export default async function PartnerStatsPage({
	params,
	searchParams,
}: {
	params: Promise<{ activationId: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { activationId } = await params;
	const resolvedSearchParams = await searchParams;
	const tokenValue = resolvedSearchParams.token;
	const token = Array.isArray(tokenValue) ? tokenValue[0] : tokenValue;

	if (!token || token.trim().length === 0) {
		return (
			<main className="container mx-auto max-w-3xl px-4 py-12">
				<section className="rounded-2xl border border-border/80 bg-card/90 p-8">
					<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						Partner Stats
					</p>
					<h1
						className="mt-2 text-3xl font-light tracking-tight sm:text-4xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Token required
					</h1>
					<p className="mt-3 text-sm text-muted-foreground sm:text-base">
						This stats page requires a valid partner token.
					</p>
				</section>
			</main>
		);
	}

	const result = await getPartnerStatsSnapshot({ activationId, token });
	if (!result.success) {
		return (
			<main className="container mx-auto max-w-3xl px-4 py-12">
				<section className="rounded-2xl border border-border/80 bg-card/90 p-8">
					<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						Partner Stats
					</p>
					<h1
						className="mt-2 text-3xl font-light tracking-tight sm:text-4xl"
						style={{ fontFamily: "var(--ooo-font-display)" }}
					>
						Stats unavailable
					</h1>
					<p className="mt-3 text-sm text-muted-foreground sm:text-base">
						{result.error}
					</p>
					<Link
						href={`${basePath}/feature-event`}
						className="mt-5 inline-block text-sm text-foreground underline underline-offset-4"
					>
						Back to partner page
					</Link>
				</section>
			</main>
		);
	}

	const { data } = result;

	return (
		<main className="container mx-auto max-w-5xl px-4 py-10 pb-16">
				<section className="rounded-2xl border border-border/80 bg-card/90 p-6 sm:p-8">
					<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						OOOC Partner Performance
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<h1
							className="text-3xl font-light tracking-tight text-foreground sm:text-4xl"
							style={{ fontFamily: "var(--ooo-font-display)" }}
						>
							{data.eventName}
						</h1>
						<Badge variant="outline" className="uppercase tracking-[0.08em]">
							{data.tier}
						</Badge>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Event key: <span className="font-mono">{data.eventKey}</span>
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Window: {new Date(data.range.startAt).toLocaleString()} -{" "}
						{new Date(data.range.endAt).toLocaleString()}
					</p>
					<div className="mt-3">
						<Link
							href={`${basePath}/api/partner-stats/${data.activationId}?token=${token}&format=csv`}
							className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
						>
							Download CSV
						</Link>
					</div>
				</section>

				<section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
					<PartnerMetricCard
						label="Event Opens"
						value={data.metrics.clickCount}
						description="Times this event page was opened."
					/>
					<PartnerMetricCard
						label="Partner Link Clicks"
						value={data.metrics.outboundClickCount}
						description="Clicks through to ticket, venue, or partner links."
					/>
					<PartnerMetricCard
						label="Calendar Adds"
						value={data.metrics.calendarSyncCount}
						description="Clicks to save the event to a calendar."
					/>
					<PartnerMetricCard
						label="Engaged Sessions"
						value={data.metrics.uniqueSessionCount}
						description="Distinct browser sessions with any tracked engagement."
					/>
					<PartnerMetricCard
						label="Link Click Session Index"
						value={formatPercent(data.metrics.outboundSessionRate)}
						description="Partner-link sessions divided by event-open sessions."
					/>
					<PartnerMetricCard
						label="Calendar Add Session Index"
						value={formatPercent(data.metrics.calendarSessionRate)}
						description="Calendar-add sessions divided by event-open sessions."
					/>
				</section>

				<section className="mt-4 rounded-xl border border-border/80 bg-card/90 p-4 text-sm text-muted-foreground">
					<p>
						Click depth: partner links per open{" "}
						<span className="font-medium text-foreground">
							{formatPercent(data.metrics.outboundInteractionRate)}
						</span>{" "}
						; calendar adds per open{" "}
						<span className="font-medium text-foreground">
							{formatPercent(data.metrics.calendarInteractionRate)}
						</span>
					</p>
				</section>

				<section className="mt-6 rounded-xl border border-border/80 bg-card/90 p-4 text-sm text-muted-foreground">
					<p className="flex items-center gap-2 font-medium text-foreground">
						<ShieldCheck className="h-4 w-4" />
						Private report
					</p>
					<p className="mt-1">
						This page is private and token-protected. Metrics are first-party
						engagement actions captured on OOOC Fete Finder.
					</p>
				</section>
		</main>
	);
}
