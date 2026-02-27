import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPartnerStatsSnapshot } from "@/features/partners/partner-stats";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FeatureEventHeader } from "../../feature-event/FeatureEventHeader";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const metadata: Metadata = {
	title: "Partner ROI Stats | OOOC Fete Finder",
	description:
		"Private partner performance metrics for OOOC campaign placements.",
	robots: {
		index: false,
		follow: false,
	},
};

export const dynamic = "force-dynamic";

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
			<div className="ooo-site-shell">
				<FeatureEventHeader />
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
			</div>
		);
	}

	const result = await getPartnerStatsSnapshot({ activationId, token });
	if (!result.success) {
		return (
			<div className="ooo-site-shell">
				<FeatureEventHeader />
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
			</div>
		);
	}

	const { data } = result;

	return (
		<div className="ooo-site-shell">
			<FeatureEventHeader />
			<main className="container mx-auto max-w-5xl px-4 py-10 pb-16">
				<section className="rounded-2xl border border-border/80 bg-card/90 p-6 sm:p-8">
					<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
						OOOC Partner ROI
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
				</section>

				<section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
					<Card className="border-border/80 bg-card">
						<CardHeader className="pb-2">
							<CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Views
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0 text-2xl font-medium tabular-nums">
							{data.metrics.clickCount}
						</CardContent>
					</Card>
					<Card className="border-border/80 bg-card">
						<CardHeader className="pb-2">
							<CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Outbound
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0 text-2xl font-medium tabular-nums">
							{data.metrics.outboundClickCount}
						</CardContent>
					</Card>
					<Card className="border-border/80 bg-card">
						<CardHeader className="pb-2">
							<CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Calendar
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0 text-2xl font-medium tabular-nums">
							{data.metrics.calendarSyncCount}
						</CardContent>
					</Card>
					<Card className="border-border/80 bg-card">
						<CardHeader className="pb-2">
							<CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Unique Sessions
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0 text-2xl font-medium tabular-nums">
							{data.metrics.uniqueSessionCount}
						</CardContent>
					</Card>
					<Card className="border-border/80 bg-card">
						<CardHeader className="pb-2">
							<CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Outbound Rate
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0 text-2xl font-medium tabular-nums">
							{formatPercent(data.metrics.outboundRate)}
						</CardContent>
					</Card>
					<Card className="border-border/80 bg-card">
						<CardHeader className="pb-2">
							<CardTitle className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
								Calendar Rate
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0 text-2xl font-medium tabular-nums">
							{formatPercent(data.metrics.calendarRate)}
						</CardContent>
					</Card>
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
		</div>
	);
}
