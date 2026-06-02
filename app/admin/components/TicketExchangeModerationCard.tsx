"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	getTicketExchangeAdminDashboard,
	reviewTicketExchangeReportAsAdmin,
	updateTicketExchangeListingStatusAsAdmin,
} from "@/features/ticket-exchange/admin-actions";
import type {
	TicketExchangeAdminDashboard,
	TicketExchangeAdminListing,
	TicketExchangeAdminReport,
	TicketExchangeListingStatus,
} from "@/features/ticket-exchange/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Pause, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

type AdminPayload = Awaited<ReturnType<typeof getTicketExchangeAdminDashboard>>;
type ModerationTab = "review" | "active" | "recent";

const formatDateTime = (value: string | null): string => {
	if (!value) return "Not yet";
	try {
		return new Intl.DateTimeFormat("en-GB", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return value;
	}
};

const statusVariant = (status: TicketExchangeListingStatus) => {
	if (status === "active") return "default" as const;
	if (status === "removed") return "destructive" as const;
	return "outline" as const;
};

const listingLabel = (listing: TicketExchangeAdminListing): string =>
	listing.listingType === "selling" ? "Selling" : "Looking";

const quantitySummary = (listing: TicketExchangeAdminListing): string => {
	const rawQuantity = listing.quantityLabel.trim();
	if (!rawQuantity) return "Not provided";
	if (!/^\d+$/.test(rawQuantity)) return rawQuantity;

	const ticketWord = rawQuantity === "1" ? "ticket" : "tickets";
	return listing.listingType === "selling"
		? `${rawQuantity} ${ticketWord} available`
		: `Looking for ${rawQuantity} ${ticketWord}`;
};

const priceSummary = (listing: TicketExchangeAdminListing): string => {
	if (listing.priceLabel) return listing.priceLabel;
	return listing.listingType === "selling" ? "Missing price" : "Not listed";
};

const statusLabel = (status: TicketExchangeListingStatus): string => {
	switch (status) {
		case "active":
			return "Active";
		case "paused":
			return "Paused";
		case "resolved":
			return "Resolved";
		case "expired":
			return "Expired";
		case "removed":
			return "Removed";
	}
};

const reportReasonLabel = (reason: string): string =>
	reason
		.split("_")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");

const applyResult = (
	result: AdminPayload,
	setDashboard: (dashboard: TicketExchangeAdminDashboard) => void,
	setError: (message: string) => void,
	setStatus: (message: string) => void,
	successMessage: string,
) => {
	if (!result.success || !result.dashboard) {
		setError(result.error || "Ticket Exchange moderation failed.");
		return;
	}
	setDashboard(result.dashboard);
	setError("");
	setStatus(successMessage);
};

const ListingRow = ({
	listing,
	onMutate,
	isMutating,
	compact = false,
}: {
	listing: TicketExchangeAdminListing;
	onMutate: (
		listingId: string,
		status: Extract<
			TicketExchangeListingStatus,
			"active" | "paused" | "resolved" | "removed"
		>,
	) => void;
	isMutating: boolean;
	compact?: boolean;
}) => {
	const listingFacts = [
		{
			label: listing.listingType === "selling" ? "Available" : "Needed",
			value: quantitySummary(listing),
		},
		{
			label: listing.listingType === "selling" ? "Price" : "Budget",
			value: priceSummary(listing),
			muted: !listing.priceLabel,
		},
		{
			label: "Interest",
			value: `${listing.interestCount} ${
				listing.interestCount === 1 ? "person" : "people"
			}`,
		},
		{ label: "Expires", value: formatDateTime(listing.expiresAt) },
		{ label: "Bot", value: formatDateTime(listing.botAnnouncedAt) },
	];

	return (
		<div className="rounded-lg border bg-background/70 p-3 transition-colors hover:bg-background">
			<div className="grid gap-3 lg:grid-cols-[1fr_auto]">
				<div className="min-w-0 space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline">{listingLabel(listing)}</Badge>
						<Badge variant={statusVariant(listing.effectiveStatus)}>
							{statusLabel(listing.effectiveStatus)}
						</Badge>
						{listing.reportCount > 0 ? (
							<Badge variant="destructive">
								{listing.reportCount}{" "}
								{listing.reportCount === 1 ? "Report" : "Reports"}
							</Badge>
						) : null}
					</div>
					<div>
						<p className="text-base font-semibold leading-snug">
							{listing.eventName}
						</p>
						<p className="text-xs text-muted-foreground">
							Owner: {listing.ownerEmail || "Unknown"}
						</p>
					</div>
					<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
						{listingFacts.map((fact) => (
							<div
								key={fact.label}
								className="rounded-md border bg-muted/20 px-2.5 py-2"
							>
								<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									{fact.label}
								</p>
								<p
									className={cn(
										"mt-1 text-sm font-medium leading-snug",
										fact.muted ? "text-muted-foreground" : "text-foreground",
									)}
								>
									{fact.value}
								</p>
							</div>
						))}
					</div>
					{listing.note && !compact ? (
						<p className="line-clamp-2 rounded-md border bg-muted/15 px-2.5 py-2 text-sm text-muted-foreground">
							{listing.note}
						</p>
					) : null}
				</div>
				<div className="rounded-lg border bg-muted/20 p-2 lg:min-w-72 lg:self-start">
					<p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						Moderation actions
					</p>
					<div className="grid grid-cols-2 gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="justify-start"
							disabled={isMutating || listing.status === "paused"}
							onClick={() => onMutate(listing.id, "paused")}
						>
							<Pause />
							Pause
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="justify-start"
							disabled={isMutating || listing.status === "active"}
							onClick={() => onMutate(listing.id, "active")}
						>
							<RefreshCw />
							Restore
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="justify-start"
							disabled={isMutating || listing.status === "resolved"}
							onClick={() => onMutate(listing.id, "resolved")}
						>
							<Check />
							Resolve
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							className="justify-start"
							disabled={isMutating || listing.status === "removed"}
							onClick={() => onMutate(listing.id, "removed")}
						>
							<Trash2 />
							Remove
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

const ReportRow = ({
	report,
	onReview,
	onRemoveListing,
	isMutating,
}: {
	report: TicketExchangeAdminReport;
	onReview: (reportId: string) => void;
	onRemoveListing: (listingId: string) => void;
	isMutating: boolean;
}) => (
	<div className="rounded-lg border border-amber-200/80 bg-amber-50/35 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
		<div className="grid gap-3 lg:grid-cols-[1fr_auto]">
			<div className="min-w-0 space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant={report.reviewedAt ? "outline" : "destructive"}>
						{report.reviewedAt ? "Reviewed" : "Needs review"}
					</Badge>
					<Badge variant="outline">{reportReasonLabel(report.reason)}</Badge>
				</div>
				<p className="font-medium leading-snug">{report.listing.eventName}</p>
				<p className="text-sm text-muted-foreground">
					{report.listing.listingType === "selling" ? "Selling" : "Looking"} ·{" "}
					{report.listing.quantityLabel}
					{report.listing.priceLabel ? ` · ${report.listing.priceLabel}` : ""}
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Owner {report.listing.ownerEmail || "unknown"} · reported{" "}
					{formatDateTime(report.createdAt)}
				</p>
				{report.details ? (
					<p className="mt-2 text-sm text-muted-foreground">{report.details}</p>
				) : null}
			</div>
			<div className="flex flex-wrap items-start justify-start gap-2 lg:justify-end">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={isMutating || Boolean(report.reviewedAt)}
					onClick={() => onReview(report.id)}
				>
					<Check />
					Reviewed
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					disabled={isMutating || report.listing.status === "removed"}
					onClick={() => onRemoveListing(report.listingId)}
				>
					<Trash2 />
					Remove listing
				</Button>
			</div>
		</div>
	</div>
);

export const TicketExchangeModerationCard = ({
	initialPayload,
}: {
	initialPayload?: AdminPayload;
}) => {
	const initialDashboard = initialPayload?.success
		? (initialPayload.dashboard ?? null)
		: null;
	const initialPendingReportCount =
		initialDashboard?.recentReports.filter((report) => !report.reviewedAt)
			.length ?? 0;
	const [dashboard, setDashboard] =
		useState<TicketExchangeAdminDashboard | null>(initialDashboard);
	const [errorMessage, setErrorMessage] = useState(
		initialPayload?.success ? "" : (initialPayload?.error ?? ""),
	);
	const [statusMessage, setStatusMessage] = useState("");
	const [activeTab, setActiveTab] = useState<ModerationTab>(
		initialPendingReportCount > 0 ? "review" : "active",
	);
	const [isPending, startTransition] = useTransition();

	const reports = useMemo(
		() => dashboard?.recentReports.filter((report) => !report.reviewedAt) ?? [],
		[dashboard],
	);
	const activeListings = useMemo(
		() =>
			dashboard?.recentListings.filter(
				(listing) => listing.effectiveStatus === "active",
			) ?? [],
		[dashboard],
	);
	const tabs: Array<{
		key: ModerationTab;
		label: string;
		count: number;
	}> = [
		{ key: "review", label: "Needs Review", count: reports.length },
		{ key: "active", label: "Active Listings", count: activeListings.length },
		{
			key: "recent",
			label: "All Recent",
			count: dashboard?.recentListings.length ?? 0,
		},
	];

	const refresh = () => {
		startTransition(async () => {
			const result = await getTicketExchangeAdminDashboard();
			if (result.success && result.dashboard) {
				const nextReportCount = result.dashboard.recentReports.filter(
					(report) => !report.reviewedAt,
				).length;
				if (nextReportCount > 0 && activeTab === "active") {
					setActiveTab("review");
				}
			}
			applyResult(
				result,
				setDashboard,
				setErrorMessage,
				setStatusMessage,
				"Ticket Exchange moderation refreshed.",
			);
		});
	};

	const mutateListing = (
		listingId: string,
		status: Extract<
			TicketExchangeListingStatus,
			"active" | "paused" | "resolved" | "removed"
		>,
	) => {
		startTransition(async () => {
			const result = await updateTicketExchangeListingStatusAsAdmin({
				listingId,
				status,
			});
			applyResult(
				result,
				setDashboard,
				setErrorMessage,
				setStatusMessage,
				`Listing marked ${status}.`,
			);
		});
	};

	const reviewReport = (reportId: string) => {
		startTransition(async () => {
			const result = await reviewTicketExchangeReportAsAdmin({ reportId });
			if (
				result.success &&
				result.dashboard &&
				result.dashboard.recentReports.every((report) => report.reviewedAt)
			) {
				setActiveTab("active");
			}
			applyResult(
				result,
				setDashboard,
				setErrorMessage,
				setStatusMessage,
				"Report marked reviewed.",
			);
		});
	};

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="border-b">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Ticket Exchange Moderation</CardTitle>
						<CardDescription>
							Work the queue: review reports, pause risky posts, and remove
							listings that should not stay live.
						</CardDescription>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={refresh}
						disabled={isPending}
					>
						<RefreshCw />
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				{errorMessage ? (
					<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
						{errorMessage}
					</div>
				) : null}
				{statusMessage ? (
					<div className="rounded-lg border bg-muted/45 p-3 text-sm text-muted-foreground">
						{statusMessage}
					</div>
				) : null}
				{dashboard ? (
					<>
						<div className="rounded-lg border bg-muted/25 p-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium">
										{reports.length > 0
											? `${reports.length} report${reports.length === 1 ? "" : "s"} need review`
											: "No reports need review"}
									</p>
									<p className="text-sm text-muted-foreground">
										{dashboard.activeSellingCount} selling and{" "}
										{dashboard.activeLookingCount} looking listings are live.
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Bot queue: {dashboard.botPendingCount ?? 0} pending ·{" "}
										{dashboard.botAnnouncedCount ?? 0} announced ·{" "}
										{dashboard.contactUnlockCount ?? 0} contact unlocks recorded
									</p>
								</div>
								{reports.length > 0 ? (
									<Badge variant="destructive" className="gap-1">
										<AlertTriangle className="size-3" />
										{reports.length} report{reports.length === 1 ? "" : "s"}
									</Badge>
								) : null}
							</div>
						</div>

						<div className="flex gap-1 rounded-lg border bg-background/70 p-1">
							{tabs.map((tab) => (
								<button
									key={tab.key}
									type="button"
									onClick={() => setActiveTab(tab.key)}
									className={cn(
										"flex min-h-8 flex-1 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium transition-colors",
										activeTab === tab.key
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground",
									)}
								>
									<span>{tab.label}</span>
									<span
										className={cn(
											"rounded-full px-1.5 py-0.5 text-[11px]",
											activeTab === tab.key
												? "bg-primary-foreground/15"
												: "bg-muted",
										)}
									>
										{tab.count}
									</span>
								</button>
							))}
						</div>

						<div className="space-y-3">
							{activeTab === "review" ? (
								reports.length > 0 ? (
									reports.map((report) => (
										<ReportRow
											key={report.id}
											report={report}
											onReview={reviewReport}
											onRemoveListing={(listingId) =>
												mutateListing(listingId, "removed")
											}
											isMutating={isPending}
										/>
									))
								) : (
									<p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
										No reports need review.
									</p>
								)
							) : null}

							{activeTab === "active" ? (
								activeListings.length > 0 ? (
									activeListings.map((listing) => (
										<ListingRow
											key={listing.id}
											listing={listing}
											onMutate={mutateListing}
											isMutating={isPending}
										/>
									))
								) : (
									<p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
										No active listings right now.
									</p>
								)
							) : null}

							{activeTab === "recent" ? (
								dashboard.recentListings.length > 0 ? (
									dashboard.recentListings.map((listing) => (
										<ListingRow
											key={listing.id}
											listing={listing}
											onMutate={mutateListing}
											isMutating={isPending}
											compact
										/>
									))
								) : (
									<p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
										No Ticket Exchange listings yet.
									</p>
								)
							) : null}
						</div>
					</>
				) : (
					<p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
						Ticket Exchange moderation data is not available yet.
					</p>
				)}
			</CardContent>
		</Card>
	);
};
