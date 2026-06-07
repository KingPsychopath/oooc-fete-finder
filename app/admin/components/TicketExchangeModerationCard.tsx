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
import {
	TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER,
	TICKET_EXCHANGE_MAX_DAILY_UNLOCKS_PER_USER,
} from "@/features/ticket-exchange/constants";
import { getTicketExchangeReportReasonLabel } from "@/features/ticket-exchange/reporting";
import type {
	TicketExchangeAdminDashboard,
	TicketExchangeAdminListing,
	TicketExchangeAdminReport,
	TicketExchangeListingType,
	TicketExchangeListingStatus,
} from "@/features/ticket-exchange/types";
import { cn } from "@/lib/utils";
import {
	AlertTriangle,
	Check,
	ExternalLink,
	Pause,
	RefreshCw,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { withAdminBasePath } from "../config";

type AdminPayload = Awaited<ReturnType<typeof getTicketExchangeAdminDashboard>>;
type ModerationTab = "review" | "active" | "recent";
type ListingTypeFilter = "all" | TicketExchangeListingType;
type ListingStatusFilter = "all" | TicketExchangeListingStatus;
type ListingSortMode =
	| "updated-desc"
	| "expires-asc"
	| "reports-desc"
	| "interest-desc"
	| "event-asc";
type ReportSortMode = "reported-desc" | "event-asc" | "reason-asc";

const PAGE_SIZE = 6;
const LISTING_STATUS_FILTERS: Array<{
	value: ListingStatusFilter;
	label: string;
}> = [
	{ value: "all", label: "All status" },
	{ value: "active", label: "Active" },
	{ value: "paused", label: "Paused" },
	{ value: "resolved", label: "Resolved" },
	{ value: "expired", label: "Expired" },
	{ value: "removed", label: "Removed" },
];
const LISTING_TYPE_FILTERS: Array<{
	value: ListingTypeFilter;
	label: string;
}> = [
	{ value: "all", label: "All types" },
	{ value: "selling", label: "Selling" },
	{ value: "looking", label: "Looking" },
];
const LISTING_SORT_OPTIONS: Array<{ value: ListingSortMode; label: string }> = [
	{ value: "updated-desc", label: "Recently updated" },
	{ value: "expires-asc", label: "Expiring first" },
	{ value: "reports-desc", label: "Most reported" },
	{ value: "interest-desc", label: "Most interest" },
	{ value: "event-asc", label: "Event A-Z" },
];
const REPORT_SORT_OPTIONS: Array<{ value: ReportSortMode; label: string }> = [
	{ value: "reported-desc", label: "Recently reported" },
	{ value: "event-asc", label: "Event A-Z" },
	{ value: "reason-asc", label: "Reason A-Z" },
];

const getRequestedModerationTab = (
	value: string | null,
): ModerationTab | null =>
	value === "review" || value === "active" || value === "recent" ? value : null;

const getRequestedListingType = (
	value: string | null,
): ListingTypeFilter | null =>
	value === "selling" || value === "looking" ? value : null;

const getRequestedListingStatus = (
	value: string | null,
): ListingStatusFilter | null =>
	value === "active" ||
	value === "paused" ||
	value === "resolved" ||
	value === "expired" ||
	value === "removed"
		? value
		: null;

const getOptionLabel = <T extends string>(
	options: Array<{ value: T; label: string }>,
	value: T,
): string => options.find((option) => option.value === value)?.label ?? value;

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

const normalizeSearch = (value: string): string => value.trim().toLowerCase();

const toTime = (value: string | null): number => {
	if (!value) return 0;
	const time = new Date(value).getTime();
	return Number.isFinite(time) ? time : 0;
};

const listingSearchText = (listing: TicketExchangeAdminListing): string =>
	[
		listing.eventName,
		listing.eventKey,
		listing.eventSlug,
		listing.ownerEmail,
		listing.listingType,
		listing.status,
		listing.effectiveStatus,
		listing.quantityLabel,
		listing.priceLabel,
		listing.note,
	].join(" ");

const reportSearchText = (report: TicketExchangeAdminReport): string =>
	[
		report.listing.eventKey,
		report.listing.eventName,
		report.listing.ownerUserId,
		report.listing.ownerEmail,
		report.listing.listingType,
		report.listing.quantityLabel,
		report.listing.priceLabel,
		report.reason,
		report.details,
		report.reporterUserId,
		report.reporter.email,
		report.reporter.firstName,
		report.reporter.lastName,
	].join(" ");

const reportPersonLabel = (person: {
	userId?: string | null;
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
}): string => {
	const name = [person.firstName, person.lastName]
		.filter(Boolean)
		.join(" ")
		.trim();
	const email = person.email?.trim() ?? "";
	if (name && email) return `${name} · ${email}`;
	return name || email || person.userId || "Unknown";
};

const getAdminUserPath = ({
	userId,
	email,
}: {
	userId?: string | null;
	email?: string | null;
}): string | null => {
	const target = userId || email;
	if (!target) return null;
	return withAdminBasePath(`/admin/users/${encodeURIComponent(target)}`);
};

const PersonEvidenceLink = ({
	person,
	userId,
}: {
	person: {
		userId?: string | null;
		email?: string | null;
		firstName?: string | null;
		lastName?: string | null;
	};
	userId?: string | null;
}) => {
	const resolvedUserId = userId ?? person.userId ?? null;
	const href = getAdminUserPath({
		userId: resolvedUserId,
		email: person.email,
	});
	const label = reportPersonLabel({ ...person, userId: resolvedUserId });
	if (!href) return <span>{label}</span>;
	return (
		<Link
			href={href}
			className="font-medium text-foreground underline-offset-4 hover:underline"
		>
			{label}
		</Link>
	);
};

const filterListings = (
	listings: TicketExchangeAdminListing[],
	input: {
		query: string;
		typeFilter: ListingTypeFilter;
		statusFilter: ListingStatusFilter;
	},
): TicketExchangeAdminListing[] => {
	const query = normalizeSearch(input.query);
	return listings.filter((listing) => {
		if (
			input.typeFilter !== "all" &&
			listing.listingType !== input.typeFilter
		) {
			return false;
		}
		if (
			input.statusFilter !== "all" &&
			listing.effectiveStatus !== input.statusFilter
		) {
			return false;
		}
		return !query || listingSearchText(listing).toLowerCase().includes(query);
	});
};

const sortListings = (
	listings: TicketExchangeAdminListing[],
	sortMode: ListingSortMode,
): TicketExchangeAdminListing[] =>
	[...listings].sort((left, right) => {
		switch (sortMode) {
			case "expires-asc":
				return toTime(left.expiresAt) - toTime(right.expiresAt);
			case "reports-desc":
				return (
					right.reportCount - left.reportCount ||
					toTime(right.updatedAt) - toTime(left.updatedAt)
				);
			case "interest-desc":
				return (
					right.interestCount - left.interestCount ||
					toTime(right.updatedAt) - toTime(left.updatedAt)
				);
			case "event-asc":
				return left.eventName.localeCompare(right.eventName);
			case "updated-desc":
				return toTime(right.updatedAt) - toTime(left.updatedAt);
		}
	});

const filterReports = (
	reports: TicketExchangeAdminReport[],
	queryInput: string,
): TicketExchangeAdminReport[] => {
	const query = normalizeSearch(queryInput);
	if (!query) return reports;
	return reports.filter((report) =>
		reportSearchText(report).toLowerCase().includes(query),
	);
};

const sortReports = (
	reports: TicketExchangeAdminReport[],
	sortMode: ReportSortMode,
): TicketExchangeAdminReport[] =>
	[...reports].sort((left, right) => {
		switch (sortMode) {
			case "event-asc":
				return left.listing.eventName.localeCompare(right.listing.eventName);
			case "reason-asc":
				return (
					getTicketExchangeReportReasonLabel(left.reason).localeCompare(
						getTicketExchangeReportReasonLabel(right.reason),
					) || toTime(right.createdAt) - toTime(left.createdAt)
				);
			case "reported-desc":
				return toTime(right.createdAt) - toTime(left.createdAt);
		}
	});

const getPageBounds = (totalCount: number, page: number) => {
	const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const safePage = Math.min(Math.max(1, page), pageCount);
	const startIndex = (safePage - 1) * PAGE_SIZE;
	const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);
	return {
		pageCount,
		safePage,
		startIndex,
		endIndex,
		rangeStart: totalCount === 0 ? 0 : startIndex + 1,
		rangeEnd: endIndex,
	};
};

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
	hasActionReason,
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
	hasActionReason: boolean;
	compact?: boolean;
}) => {
	const expiresAt = new Date(listing.expiresAt).getTime();
	const isExpired = Number.isFinite(expiresAt) && expiresAt <= Date.now();
	const canRestore =
		!isExpired &&
		listing.effectiveStatus !== "active" &&
		(listing.status === "paused" || listing.status === "removed");
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
	const ownerHref = getAdminUserPath({
		userId: listing.ownerUserId,
		email: listing.ownerEmail,
	});
	const ownerLabel = listing.ownerEmail || listing.ownerUserId || "Unknown";
	const pauseTitle = !hasActionReason
		? "Enter a moderation note before changing listing state"
		: listing.effectiveStatus === "active"
			? "Pause this live listing"
			: "Only active listings can be paused";
	const restoreTitle = !hasActionReason
		? "Enter a moderation note before changing listing state"
		: isExpired
			? "Expired listings cannot be restored without a new expiry"
			: canRestore
				? "Restore this paused or removed listing"
				: "Only paused or removed, unexpired listings can be restored";
	const resolveTitle = !hasActionReason
		? "Enter a moderation note before changing listing state"
		: listing.status === "resolved"
			? "This listing is already resolved"
			: "Mark this listing resolved";
	const removeTitle = !hasActionReason
		? "Enter a moderation note before changing listing state"
		: listing.status === "removed"
			? "This listing is already removed"
			: "Remove this listing from the exchange";

	return (
		<div
			id={`ticket-listing-${listing.id}`}
			className="scroll-mt-44 rounded-lg border bg-background/70 p-3 transition-colors hover:bg-background"
		>
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
								{listing.reportCount === 1
									? "report against listing"
									: "reports against listing"}
							</Badge>
						) : null}
					</div>
					<div>
						<p className="text-base font-semibold leading-snug">
							{listing.eventName}
						</p>
						<p className="text-xs text-muted-foreground">
							Owner:{" "}
							{ownerHref ? (
								<Link
									href={ownerHref}
									className="font-medium text-foreground underline-offset-4 hover:underline"
								>
									{ownerLabel}
								</Link>
							) : (
								ownerLabel
							)}
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
							disabled={
								isMutating ||
								!hasActionReason ||
								listing.effectiveStatus !== "active"
							}
							title={pauseTitle}
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
							disabled={isMutating || !hasActionReason || !canRestore}
							title={restoreTitle}
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
							disabled={
								isMutating || !hasActionReason || listing.status === "resolved"
							}
							title={resolveTitle}
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
							disabled={
								isMutating || !hasActionReason || listing.status === "removed"
							}
							title={removeTitle}
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
	hasActionReason,
}: {
	report: TicketExchangeAdminReport;
	onReview: (reportId: string) => void;
	onRemoveListing: (listingId: string) => void;
	isMutating: boolean;
	hasActionReason: boolean;
}) => {
	const markReviewedTitle = report.reviewedAt
		? "This report is already reviewed"
		: hasActionReason
			? "Mark this report reviewed and remove it from the moderation queue"
			: "Enter a moderation note before reviewing this report";
	const removeListingTitle = !hasActionReason
		? "Enter a moderation note before removing this listing"
		: report.listing.status === "removed"
			? "The reported listing is already removed"
			: "Remove the reported listing from the exchange";

	return (
		<div
			id={`ticket-report-${report.id}`}
			className="scroll-mt-44 rounded-lg border border-amber-200/80 bg-amber-50/35 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"
		>
			<div className="grid gap-3 lg:grid-cols-[1fr_auto]">
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant={report.reviewedAt ? "outline" : "destructive"}>
							{report.reviewedAt ? "Reviewed" : "Needs review"}
						</Badge>
						<Badge variant="outline">
							{getTicketExchangeReportReasonLabel(report.reason)}
						</Badge>
					</div>
					<p className="font-medium leading-snug">{report.listing.eventName}</p>
					<p className="text-sm text-muted-foreground">
						{report.listing.listingType === "selling" ? "Selling" : "Looking"} ·{" "}
						{report.listing.quantityLabel}
						{report.listing.priceLabel ? ` · ${report.listing.priceLabel}` : ""}
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Reported {formatDateTime(report.createdAt)}
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="rounded-md border bg-background/65 px-3 py-2 text-xs">
							<p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
								Listing owner
							</p>
							<p className="mt-1">
								<PersonEvidenceLink
									person={report.listing.owner}
									userId={report.listing.ownerUserId}
								/>
							</p>
						</div>
						<div className="rounded-md border bg-background/65 px-3 py-2 text-xs">
							<p className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
								Reporter
							</p>
							<p className="mt-1">
								<PersonEvidenceLink
									person={report.reporter}
									userId={report.reporterUserId}
								/>
							</p>
						</div>
					</div>
					<div className="mt-2 rounded-md border border-amber-300/60 bg-background/65 px-3 py-2">
						<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/80 dark:text-amber-100/80">
							Report message
						</p>
						<p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
							{report.details || "No extra message from the reporter."}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{report.listing.eventKey ? (
							<Link
								href={withAdminBasePath(
									`/exchange/${encodeURIComponent(report.listing.eventKey)}`,
								)}
							>
								<Button type="button" variant="outline" size="sm">
									<ExternalLink />
									Exchange
								</Button>
							</Link>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap items-start justify-start gap-2 lg:justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={
							isMutating || !hasActionReason || Boolean(report.reviewedAt)
						}
						title={markReviewedTitle}
						onClick={() => onReview(report.id)}
					>
						<Check />
						Mark reviewed
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						disabled={
							isMutating ||
							!hasActionReason ||
							report.listing.status === "removed"
						}
						title={removeListingTitle}
						onClick={() => onRemoveListing(report.listingId)}
					>
						<Trash2 />
						Remove listing
					</Button>
				</div>
			</div>
		</div>
	);
};

export const TicketExchangeModerationCard = ({
	initialPayload,
}: {
	initialPayload?: AdminPayload;
}) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const requestedTab = getRequestedModerationTab(
		searchParams.get("ticketModeration"),
	);
	const requestedType = getRequestedListingType(searchParams.get("ticketType"));
	const requestedStatus = getRequestedListingStatus(
		searchParams.get("ticketStatus"),
	);
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
		requestedTab ?? (initialPendingReportCount > 0 ? "review" : "active"),
	);
	const [query, setQuery] = useState("");
	const [listingTypeFilter, setListingTypeFilter] = useState<ListingTypeFilter>(
		requestedType ?? "all",
	);
	const [listingStatusFilter, setListingStatusFilter] =
		useState<ListingStatusFilter>(requestedStatus ?? "all");
	const [listingSortMode, setListingSortMode] =
		useState<ListingSortMode>("updated-desc");
	const [reportSortMode, setReportSortMode] =
		useState<ReportSortMode>("reported-desc");
	const [moderationReason, setModerationReason] = useState("");
	const [page, setPage] = useState(1);
	const [isPending, startTransition] = useTransition();
	const hasModerationReason = moderationReason.trim().length > 0;

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
	const listingSource =
		activeTab === "active" ? activeListings : (dashboard?.recentListings ?? []);
	const filteredReports = useMemo(
		() => sortReports(filterReports(reports, query), reportSortMode),
		[query, reports, reportSortMode],
	);
	const filteredListings = useMemo(
		() =>
			sortListings(
				filterListings(listingSource, {
					query,
					typeFilter: listingTypeFilter,
					statusFilter: activeTab === "active" ? "active" : listingStatusFilter,
				}),
				listingSortMode,
			),
		[
			activeTab,
			listingSource,
			listingSortMode,
			listingStatusFilter,
			listingTypeFilter,
			query,
		],
	);
	const currentTotal =
		activeTab === "review" ? filteredReports.length : filteredListings.length;
	const pageBounds = getPageBounds(currentTotal, page);
	const visibleReports = filteredReports.slice(
		pageBounds.startIndex,
		pageBounds.endIndex,
	);
	const visibleListings = filteredListings.slice(
		pageBounds.startIndex,
		pageBounds.endIndex,
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
	const activeControlCount = [
		query.trim().length > 0,
		activeTab !== "review" && listingTypeFilter !== "all",
		activeTab === "recent" && listingStatusFilter !== "all",
	].filter(Boolean).length;
	const currentSortLabel =
		activeTab === "review"
			? getOptionLabel(REPORT_SORT_OPTIONS, reportSortMode)
			: getOptionLabel(LISTING_SORT_OPTIONS, listingSortMode);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (activeTab !== "review") return;
		const anchorId = window.location.hash.replace(/^#/, "").trim();
		if (!anchorId.startsWith("ticket-report-")) return;
		const reportId = anchorId.replace(/^ticket-report-/, "");
		const reportIndex = filteredReports.findIndex(
			(report) => report.id === reportId,
		);
		if (reportIndex < 0) return;
		const targetPage = Math.floor(reportIndex / PAGE_SIZE) + 1;
		if (targetPage !== page) {
			setPage(targetPage);
			return;
		}
		window.setTimeout(() => {
			document.getElementById(anchorId)?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}, 0);
	}, [activeTab, filteredReports, page]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const anchorId = window.location.hash.replace(/^#/, "").trim();
		if (!anchorId.startsWith("ticket-listing-")) return;
		const listingId = anchorId.replace(/^ticket-listing-/, "");
		const listings = dashboard?.recentListings ?? [];
		const listingIndex = listings.findIndex(
			(listing) => listing.id === listingId,
		);
		if (listingIndex < 0) return;
		if (activeTab !== "recent") {
			setActiveTab("recent");
			return;
		}
		if (query) {
			setQuery("");
			return;
		}
		if (listingTypeFilter !== "all") {
			setListingTypeFilter("all");
			return;
		}
		if (listingStatusFilter !== "all") {
			setListingStatusFilter("all");
			return;
		}
		const targetPage = Math.floor(listingIndex / PAGE_SIZE) + 1;
		if (targetPage !== page) {
			setPage(targetPage);
			return;
		}
		window.setTimeout(() => {
			document.getElementById(anchorId)?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		}, 0);
	}, [
		activeTab,
		dashboard?.recentListings,
		listingStatusFilter,
		listingTypeFilter,
		page,
		query,
	]);

	const selectTab = (tab: ModerationTab) => {
		setActiveTab(tab);
		setPage(1);
	};

	const updateQuery = (value: string) => {
		setQuery(value);
		setPage(1);
	};

	const updateListingTypeFilter = (value: ListingTypeFilter) => {
		setListingTypeFilter(value);
		setPage(1);
	};

	const updateListingStatusFilter = (value: ListingStatusFilter) => {
		setListingStatusFilter(value);
		setPage(1);
	};

	const updateListingSortMode = (value: ListingSortMode) => {
		setListingSortMode(value);
		setPage(1);
	};

	const updateReportSortMode = (value: ReportSortMode) => {
		setReportSortMode(value);
		setPage(1);
	};
	const clearControls = () => {
		setQuery("");
		setListingTypeFilter("all");
		setListingStatusFilter("all");
		setPage(1);
	};

	const refresh = () => {
		startTransition(async () => {
			const result = await getTicketExchangeAdminDashboard();
			if (result.success && result.dashboard) {
				const nextReportCount = result.dashboard.recentReports.filter(
					(report) => !report.reviewedAt,
				).length;
				if (nextReportCount > 0 && activeTab === "active") {
					selectTab("review");
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
		const reason = moderationReason.trim();
		if (!reason) {
			setErrorMessage("Enter a moderation note before changing listing state.");
			setStatusMessage("");
			return;
		}
		if (
			status === "removed" &&
			!window.confirm(
				"Remove this listing from the exchange? The moderation note will be recorded in the admin audit log.",
			)
		) {
			return;
		}
		startTransition(async () => {
			const result = await updateTicketExchangeListingStatusAsAdmin({
				listingId,
				status,
				reason,
			});
			if (result.success) {
				setModerationReason("");
				router.refresh();
			}
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
		const reviewNote = moderationReason.trim();
		if (!reviewNote) {
			setErrorMessage("Enter a moderation note before reviewing this report.");
			setStatusMessage("");
			return;
		}
		startTransition(async () => {
			const result = await reviewTicketExchangeReportAsAdmin({
				reportId,
				reviewNote,
			});
			if (
				result.success &&
				result.dashboard &&
				result.dashboard.recentReports.every((report) => report.reviewedAt)
			) {
				selectTab("active");
			}
			if (result.success) {
				setModerationReason("");
				router.refresh();
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
											? `${reports.length} report${reports.length === 1 ? " needs" : "s need"} review`
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

						<div className="rounded-lg border bg-background/70 p-3">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p className="text-sm font-medium">Unlock watch</p>
									<p className="text-xs text-muted-foreground">
										Active/locked slots and new contact unlocks in the last 24
										hours.
									</p>
								</div>
								<Badge variant="outline">
									{dashboard.unlockWatch.length} user
									{dashboard.unlockWatch.length === 1 ? "" : "s"}
								</Badge>
							</div>
							{dashboard.unlockWatch.length > 0 ? (
								<div className="mt-3 grid gap-2">
									{dashboard.unlockWatch.map((item) => (
										<div
											key={item.actorUserId}
											className="grid gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
										>
											<div className="min-w-0">
												<Link
													href={withAdminBasePath(
														`/admin/users/${encodeURIComponent(item.actorUserId)}`,
													)}
													className="block truncate font-medium text-foreground underline-offset-4 hover:underline"
												>
													{item.actorEmail || item.actorUserId}
												</Link>
												<p className="text-xs text-muted-foreground">
													Latest unlock {formatDateTime(item.latestUnlockAt)}
												</p>
											</div>
											<div className="flex flex-wrap gap-2 text-xs">
												<Badge variant="outline">
													{item.activeOrLockedCount}/
													{TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER} active
												</Badge>
												<Badge variant="outline">
													{item.dailyUnlockCount}/
													{TICKET_EXCHANGE_MAX_DAILY_UNLOCKS_PER_USER} today
												</Badge>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="mt-3 rounded-md border bg-muted/20 px-2.5 py-2 text-sm text-muted-foreground">
									No active or recent contact unlocks.
								</p>
							)}
						</div>

						<div className="flex gap-1 rounded-lg border bg-background/70 p-1">
							{tabs.map((tab) => (
								<button
									key={tab.key}
									type="button"
									onClick={() => selectTab(tab.key)}
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

						<div className="rounded-lg border bg-background/70 p-3">
							<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
								<label className="min-w-0 text-xs font-medium text-muted-foreground">
									Search
									<input
										type="search"
										value={query}
										onChange={(event) => updateQuery(event.target.value)}
										placeholder={
											activeTab === "review"
												? "Event, owner, reason, details"
												: "Event, owner, note, status"
										}
										className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
									/>
								</label>
								{activeTab !== "review" ? (
									<label className="text-xs font-medium text-muted-foreground">
										Type
										<select
											value={listingTypeFilter}
											onChange={(event) =>
												updateListingTypeFilter(
													event.target.value as ListingTypeFilter,
												)
											}
											className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground outline-none focus:border-foreground/40 lg:w-36"
										>
											{LISTING_TYPE_FILTERS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</label>
								) : null}
								{activeTab === "recent" ? (
									<label className="text-xs font-medium text-muted-foreground">
										Status
										<select
											value={listingStatusFilter}
											onChange={(event) =>
												updateListingStatusFilter(
													event.target.value as ListingStatusFilter,
												)
											}
											className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground outline-none focus:border-foreground/40 lg:w-40"
										>
											{LISTING_STATUS_FILTERS.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
									</label>
								) : null}
								<label className="text-xs font-medium text-muted-foreground">
									Sort
									<select
										value={
											activeTab === "review" ? reportSortMode : listingSortMode
										}
										onChange={(event) => {
											if (activeTab === "review") {
												updateReportSortMode(
													event.target.value as ReportSortMode,
												);
												return;
											}
											updateListingSortMode(
												event.target.value as ListingSortMode,
											);
										}}
										className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground outline-none focus:border-foreground/40 lg:w-44"
									>
										{(activeTab === "review"
											? REPORT_SORT_OPTIONS
											: LISTING_SORT_OPTIONS
										).map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</label>
							</div>
							<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
								<span>
									Showing {pageBounds.rangeStart}-{pageBounds.rangeEnd} of{" "}
									{currentTotal}
								</span>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={pageBounds.safePage <= 1}
										onClick={() =>
											setPage((current) => Math.max(1, current - 1))
										}
									>
										Previous
									</Button>
									<span>
										Page {pageBounds.safePage} of {pageBounds.pageCount}
									</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={pageBounds.safePage >= pageBounds.pageCount}
										onClick={() =>
											setPage((current) =>
												Math.min(pageBounds.pageCount, current + 1),
											)
										}
									>
										Next
									</Button>
								</div>
							</div>
							<label className="mt-3 block text-xs font-medium text-muted-foreground">
								Moderation note
								<textarea
									value={moderationReason}
									onChange={(event) => setModerationReason(event.target.value)}
									placeholder={
										activeTab === "review"
											? "Decision note required before reviewing reports or removing a reported listing"
											: "Reason required before pausing, restoring, resolving, or removing listings"
									}
									rows={2}
									className="mt-1 min-h-16 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
								/>
							</label>
							<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<Badge variant="secondary">
									View: {tabs.find((tab) => tab.key === activeTab)?.label}
								</Badge>
								<Badge variant="outline">Sort: {currentSortLabel}</Badge>
								{activeControlCount > 0 ? (
									<>
										<Badge variant="outline">
											{activeControlCount} active filter
											{activeControlCount === 1 ? "" : "s"}
										</Badge>
										{query.trim() ? (
											<Badge variant="outline">Search: {query.trim()}</Badge>
										) : null}
										{activeTab !== "review" && listingTypeFilter !== "all" ? (
											<Badge variant="outline">
												Type:{" "}
												{getOptionLabel(
													LISTING_TYPE_FILTERS,
													listingTypeFilter,
												)}
											</Badge>
										) : null}
										{activeTab === "recent" && listingStatusFilter !== "all" ? (
											<Badge variant="outline">
												Status:{" "}
												{getOptionLabel(
													LISTING_STATUS_FILTERS,
													listingStatusFilter,
												)}
											</Badge>
										) : null}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 px-2 text-xs"
											onClick={clearControls}
										>
											Clear filters
										</Button>
									</>
								) : (
									<span>No search or listing filters applied.</span>
								)}
							</div>
						</div>

						<div className="max-h-[56rem] space-y-3 overflow-y-auto pr-1">
							{activeTab === "review" ? (
								visibleReports.length > 0 ? (
									visibleReports.map((report) => (
										<ReportRow
											key={report.id}
											report={report}
											onReview={reviewReport}
											onRemoveListing={(listingId) =>
												mutateListing(listingId, "removed")
											}
											isMutating={isPending}
											hasActionReason={hasModerationReason}
										/>
									))
								) : (
									<p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
										{reports.length > 0
											? "No reports match the current controls."
											: "No reports need review."}
									</p>
								)
							) : null}

							{activeTab === "active" ? (
								visibleListings.length > 0 ? (
									visibleListings.map((listing) => (
										<ListingRow
											key={listing.id}
											listing={listing}
											onMutate={mutateListing}
											isMutating={isPending}
											hasActionReason={hasModerationReason}
										/>
									))
								) : (
									<p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
										{activeListings.length > 0
											? "No active listings match the current controls."
											: "No active listings right now."}
									</p>
								)
							) : null}

							{activeTab === "recent" ? (
								visibleListings.length > 0 ? (
									visibleListings.map((listing) => (
										<ListingRow
											key={listing.id}
											listing={listing}
											onMutate={mutateListing}
											isMutating={isPending}
											hasActionReason={hasModerationReason}
											compact
										/>
									))
								) : (
									<p className="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground">
										{dashboard.recentListings.length > 0
											? "No recent listings match the current controls."
											: "No Ticket Exchange listings yet."}
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
