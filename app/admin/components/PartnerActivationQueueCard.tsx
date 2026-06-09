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
	fulfillPartnerActivation,
	generatePartnerStatsTestLink,
	getPartnerActivationDashboard,
	previewPartnerStatsReport,
	regeneratePartnerStatsLink,
	revokePartnerStatsLink,
	updatePartnerActivationStatus,
} from "@/features/partners/activation-actions";
import type { PartnerActivationStatus } from "@/lib/platform/postgres/partner-activation-repository";
import { formatAdminDateTime } from "@/lib/ui/admin-date-format";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardPayload = Awaited<
	ReturnType<typeof getPartnerActivationDashboard>
>;

type FulfillmentInput = {
	eventKey: string;
	tier: "spotlight" | "promoted";
	scheduleAt: string;
	durationHours: string;
};

type TestLinkInput = {
	eventKey: string;
	tier: "spotlight" | "promoted";
	scheduleAt: string;
	durationHours: string;
};

type FulfilledReportFilter = "all" | "paid" | "manual" | "scheduler";

const STATUS_LABEL: Record<PartnerActivationStatus, string> = {
	pending: "Needs Fulfillment",
	processing: "In Progress",
	activated: "Fulfilled / Reports",
	dismissed: "Dismissed",
};

const STATUS_SUMMARY_LABEL: Record<PartnerActivationStatus, string> = {
	pending: "Needs Fulfillment",
	processing: "In Progress",
	activated: "Fulfilled",
	dismissed: "Dismissed",
};

const STATUS_CARD_HINT: Record<PartnerActivationStatus, string> = {
	pending: "Open orders waiting for setup",
	processing: "Open orders being handled",
	activated: "Open reports and fulfilled orders",
	dismissed: "Open dismissed history",
};

const WINDOW_PRESETS = [
	{ key: "last-48h", label: "Last 48h", hours: 48 },
	{ key: "last-7d", label: "Last 7d", hours: 168 },
	{ key: "from-now", label: "From Now", hours: 48 },
] as const;

const LIST_LIMIT_OPTIONS = [5, 10, 20, 50] as const;

const FULFILLED_REPORT_FILTERS: Array<{
	value: FulfilledReportFilter;
	label: string;
}> = [
	{ value: "all", label: "All" },
	{ value: "paid", label: "Paid Orders" },
	{ value: "manual", label: "Manual Reports" },
	{ value: "scheduler", label: "Scheduler Reports" },
];

const STATUS_ORDER: PartnerActivationStatus[] = [
	"pending",
	"processing",
	"activated",
	"dismissed",
];

const isPartnerActivationStatus = (
	value: string | null,
): value is PartnerActivationStatus =>
	value === "pending" ||
	value === "processing" ||
	value === "activated" ||
	value === "dismissed";

const getInitialActivationStatus = (): PartnerActivationStatus => {
	if (typeof window === "undefined") return "pending";
	const params = new URLSearchParams(window.location.search);
	const requestedStatus = params.get("activationStatus");
	return isPartnerActivationStatus(requestedStatus)
		? requestedStatus
		: "pending";
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const inferTierFromPackageKey = (
	packageKey: string | null,
): "spotlight" | "promoted" => {
	const normalized = (packageKey || "").toLowerCase();
	if (normalized.includes("promoted")) return "promoted";
	return "spotlight";
};

const defaultScheduleAt = (): string => {
	const now = new Date();
	now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
	return now.toISOString().slice(0, 16);
};

const toDateTimeLocalInput = (date: Date): string => {
	const localDate = new Date(date);
	localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
	return localDate.toISOString().slice(0, 16);
};

const getWindowEnd = (input: TestLinkInput): Date | null => {
	const startDate = new Date(input.scheduleAt);
	const durationHours = Number.parseInt(input.durationHours, 10);
	if (
		!Number.isFinite(startDate.getTime()) ||
		!Number.isFinite(durationHours)
	) {
		return null;
	}
	return new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
};

const isReportWindowInputReady = (input: {
	eventKey: string;
	scheduleAt: string;
	durationHours: string;
}): boolean => {
	const durationHours = Number.parseInt(input.durationHours, 10);
	return (
		input.eventKey.trim().length > 0 &&
		Number.isFinite(new Date(input.scheduleAt).getTime()) &&
		Number.isFinite(durationHours) &&
		durationHours >= 1 &&
		durationHours <= 168
	);
};

const formatReportDateTime = (value: Date | string): string =>
	formatAdminDateTime(value);

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const formatDuration = (startAt: string, endAt: string): string | null => {
	const start = new Date(startAt);
	const end = new Date(endAt);
	if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
		return null;
	}
	const durationHours = Math.max(
		0,
		Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000)),
	);
	if (durationHours < 24) return `${durationHours}h`;
	const durationDays = durationHours / 24;
	if (Number.isInteger(durationDays)) return `${durationDays}d`;
	return `${durationHours}h`;
};

const toPartnerStatsPath = (id: string, token: string): string =>
	`${basePath}/partner-stats/${id}?token=${token}`;

const toPartnerStatsAbsoluteUrl = (path: string): string => {
	if (/^https?:\/\//i.test(path)) return path;
	if (typeof window === "undefined") return path;
	return `${window.location.origin}${path}`;
};

export const PartnerActivationQueueCard = ({
	initialPayload,
}: {
	initialPayload?: DashboardPayload;
}) => {
	const [payload, setPayload] = useState<DashboardPayload | null>(
		initialPayload ?? null,
	);
	const [isLoading, setIsLoading] = useState(false);
	const [isMutating, setIsMutating] = useState(false);
	const [activeStatus, setActiveStatus] = useState<PartnerActivationStatus>(
		getInitialActivationStatus,
	);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [activationSearchTerm, setActivationSearchTerm] = useState("");
	const [fulfilledReportFilter, setFulfilledReportFilter] =
		useState<FulfilledReportFilter>("all");
	const [activationVisibleLimit, setActivationVisibleLimit] = useState<number>(
		LIST_LIMIT_OPTIONS[1],
	);
	const [queueActionNote, setQueueActionNote] = useState("");
	const [fulfillmentInputs, setFulfillmentInputs] = useState<
		Record<string, FulfillmentInput>
	>({});
	const [testLinkInput, setTestLinkInput] = useState<TestLinkInput>({
		eventKey: "",
		tier: "spotlight",
		scheduleAt: defaultScheduleAt(),
		durationHours: "48",
	});
	const [generatedTestLink, setGeneratedTestLink] = useState<string | null>(
		null,
	);
	const [previewPayload, setPreviewPayload] = useState<Awaited<
		ReturnType<typeof previewPartnerStatsReport>
	> | null>(null);

	const loadDashboard = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage("");
		try {
			const result = await getPartnerActivationDashboard();
			setPayload(result);
			if (!result.success) {
				setErrorMessage(result.error || "Failed to load activation queue");
				return;
			}
			setFulfillmentInputs((current) => {
				const next = { ...current };
				for (const item of result.items) {
					if (!next[item.id]) {
						next[item.id] = {
							eventKey: item.fulfilledEventKey ?? "",
							tier:
								item.fulfilledTier ?? inferTierFromPackageKey(item.packageKey),
							scheduleAt: defaultScheduleAt(),
							durationHours: "48",
						};
					}
				}
				return next;
			});
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialPayload?.success) {
			setFulfillmentInputs((current) => {
				const next = { ...current };
				for (const item of initialPayload.items) {
					if (!next[item.id]) {
						next[item.id] = {
							eventKey: item.fulfilledEventKey ?? "",
							tier:
								item.fulfilledTier ?? inferTierFromPackageKey(item.packageKey),
							scheduleAt: defaultScheduleAt(),
							durationHours: "48",
						};
					}
				}
				return next;
			});
			return;
		}
		void loadDashboard();
	}, [initialPayload, loadDashboard]);

	useEffect(() => {
		const revealHashedActivation = () => {
			if (!window.location.hash.startsWith("#partner-activation-")) return;
			const params = new URLSearchParams(window.location.search);
			const requestedStatus = params.get("activationStatus");
			if (isPartnerActivationStatus(requestedStatus)) {
				setActiveStatus(requestedStatus);
			}
			setActivationSearchTerm("");
			window.setTimeout(() => {
				document
					.getElementById(window.location.hash.slice(1))
					?.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 120);
		};

		revealHashedActivation();
		window.addEventListener("hashchange", revealHashedActivation);
		return () =>
			window.removeEventListener("hashchange", revealHashedActivation);
	}, []);

	const withMutation = useCallback(
		async (id: string, status: PartnerActivationStatus) => {
			const note = queueActionNote.trim();
			if (!note) {
				setErrorMessage("Add an operator note before changing queue status.");
				setStatusMessage("");
				return;
			}
			setIsMutating(true);
			setBusyId(id);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await updatePartnerActivationStatus({
					id,
					status,
					notes: note,
				});
				if (!result.success) {
					setErrorMessage(result.error || result.message);
					return;
				}
				setQueueActionNote("");
				setStatusMessage(result.message);
				await loadDashboard();
			} finally {
				setIsMutating(false);
				setBusyId(null);
			}
		},
		[loadDashboard, queueActionNote],
	);

	const handleDismiss = useCallback(
		async (item: { id: string; status: PartnerActivationStatus }) => {
			if (item.status === "activated") {
				const confirmed = window.confirm(
					"Dismiss this fulfilled/report item? Its partner stats link will no longer appear in the Fulfilled / Reports tab.",
				);
				if (!confirmed) return;
			}
			await withMutation(item.id, "dismissed");
		},
		[withMutation],
	);

	const handleFulfill = useCallback(
		async (id: string) => {
			const input = fulfillmentInputs[id];
			if (!input || !isReportWindowInputReady(input)) {
				setErrorMessage(
					"Select an event key, valid start time, and 1-168 hour duration before fulfilling this activation.",
				);
				return;
			}
			setIsMutating(true);
			setBusyId(id);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await fulfillPartnerActivation({
					activationId: id,
					eventKey: input.eventKey.trim(),
					tier: input.tier,
					requestedStartAt: input.scheduleAt,
					durationHours: Number.parseInt(input.durationHours, 10),
				});
				if (!result.success) {
					setErrorMessage(result.error || result.message);
					return;
				}
				setStatusMessage(
					result.statsPath
						? `${result.message}. Partner stats link generated.`
						: result.message,
				);
				await loadDashboard();
			} finally {
				setIsMutating(false);
				setBusyId(null);
			}
		},
		[fulfillmentInputs, loadDashboard],
	);

	const handleCopyStatsLink = useCallback((path: string) => {
		const absoluteUrl = toPartnerStatsAbsoluteUrl(path);
		void navigator.clipboard
			.writeText(absoluteUrl)
			.then(() => {
				setStatusMessage("Partner stats link copied");
			})
			.catch(() => {
				setErrorMessage("Could not copy partner stats link");
			});
	}, []);

	const handleRevokeStatsLink = useCallback(
		async (id: string) => {
			const note = queueActionNote.trim();
			if (!note) {
				setErrorMessage("Add a queue action note before revoking this link.");
				setStatusMessage("");
				return;
			}
			const confirmed = window.confirm(
				"Revoke this partner stats link? Existing URLs for this report will stop working until a new link is generated.",
			);
			if (!confirmed) return;
			setIsMutating(true);
			setBusyId(id);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await revokePartnerStatsLink({
					activationId: id,
					notes: note,
				});
				if (!result.success) {
					setErrorMessage(result.error || result.message);
					return;
				}
				setQueueActionNote("");
				setStatusMessage(result.message);
				await loadDashboard();
			} finally {
				setIsMutating(false);
				setBusyId(null);
			}
		},
		[loadDashboard, queueActionNote],
	);

	const handleRegenerateStatsLink = useCallback(
		async (id: string) => {
			const note = queueActionNote.trim();
			if (!note) {
				setErrorMessage("Add a queue action note before regenerating this link.");
				setStatusMessage("");
				return;
			}
			const confirmed = window.confirm(
				"Generate a new partner stats link? Any previously revoked URL remains unusable, and the new URL can be copied from this row.",
			);
			if (!confirmed) return;
			setIsMutating(true);
			setBusyId(id);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await regeneratePartnerStatsLink({
					activationId: id,
					notes: note,
				});
				if (!result.success) {
					setErrorMessage(result.error || result.message);
					return;
				}
				setQueueActionNote("");
				setStatusMessage(result.message);
				await loadDashboard();
			} finally {
				setIsMutating(false);
				setBusyId(null);
			}
		},
		[loadDashboard, queueActionNote],
	);

	const updateTestLinkInput = useCallback((nextInput: TestLinkInput) => {
		setPreviewPayload(null);
		setGeneratedTestLink(null);
		setTestLinkInput(nextInput);
	}, []);

	const handleGenerateTestLink = useCallback(async () => {
		if (!isReportWindowInputReady(testLinkInput)) {
			setErrorMessage(
				"Select an event key, valid start time, and 1-168 hour duration to create a manual stats report.",
			);
			return;
		}
		setIsMutating(true);
		setStatusMessage("");
		setErrorMessage("");
		setGeneratedTestLink(null);
		try {
			const result = await generatePartnerStatsTestLink({
				eventKey: testLinkInput.eventKey.trim(),
				tier: testLinkInput.tier,
				requestedStartAt: testLinkInput.scheduleAt,
				durationHours: Number.parseInt(testLinkInput.durationHours, 10),
			});
			if (!result.success) {
				setErrorMessage(result.error || result.message);
				return;
			}
			setGeneratedTestLink(result.statsPath);
			setStatusMessage(
				"Manual partner stats report created. The link uses the selected event and report window.",
			);
			await loadDashboard();
		} finally {
			setIsMutating(false);
		}
	}, [loadDashboard, testLinkInput]);

	const handlePreviewReport = useCallback(async () => {
		if (!isReportWindowInputReady(testLinkInput)) {
			setErrorMessage(
				"Select an event key, valid start time, and 1-168 hour duration before previewing stats.",
			);
			return;
		}
		setIsMutating(true);
		setStatusMessage("");
		setErrorMessage("");
		setPreviewPayload(null);
		try {
			const result = await previewPartnerStatsReport({
				eventKey: testLinkInput.eventKey.trim(),
				requestedStartAt: testLinkInput.scheduleAt,
				durationHours: Number.parseInt(testLinkInput.durationHours, 10),
			});
			setPreviewPayload(result);
			if (!result.success) {
				setErrorMessage(result.error || result.message);
				return;
			}
			setStatusMessage("Report window preview updated");
		} finally {
			setIsMutating(false);
		}
	}, [testLinkInput]);

	const handleApplyWindowPreset = useCallback(
		(preset: (typeof WINDOW_PRESETS)[number]) => {
			const now = new Date();
			const startDate =
				preset.key === "from-now"
					? now
					: new Date(now.getTime() - preset.hours * 60 * 60 * 1000);
			setPreviewPayload(null);
			setGeneratedTestLink(null);
			setTestLinkInput((current) => ({
				...current,
				scheduleAt: toDateTimeLocalInput(startDate),
				durationHours: String(preset.hours),
			}));
		},
		[],
	);

	const statusItems = useMemo(() => {
		if (!payload?.success) return [];
		return payload.items.filter((item) => item.status === activeStatus);
	}, [activeStatus, payload]);

	const metrics = payload?.success
		? payload.metrics
		: { total: 0, pending: 0, processing: 0, activated: 0, dismissed: 0 };
	const events = payload?.success ? payload.events : [];
	const eventNameByKey = useMemo(
		() => new Map(events.map((event) => [event.eventKey, event.name])),
		[events],
	);
	const reportEndDate = getWindowEnd(testLinkInput);
	const selectedManualReportEvent = events.find(
		(event) => event.eventKey === testLinkInput.eventKey,
	);
	const canUseManualReportWindow = isReportWindowInputReady(testLinkInput);
	const reportFilteredItems = useMemo(() => {
		if (activeStatus !== "activated" || fulfilledReportFilter === "all") {
			return statusItems;
		}
		return statusItems.filter((item) => {
			const packageKey = item.packageKey ?? "";
			const isManualReport = packageKey.startsWith("manual-test-");
			const isSchedulerReport = packageKey.startsWith("scheduler-report-");
			if (fulfilledReportFilter === "manual") return isManualReport;
			if (fulfilledReportFilter === "scheduler") return isSchedulerReport;
			return !isManualReport && !isSchedulerReport;
		});
	}, [activeStatus, fulfilledReportFilter, statusItems]);
	const filteredItems = useMemo(() => {
		const needle = activationSearchTerm.trim().toLowerCase();
		if (!needle) return reportFilteredItems;
		return reportFilteredItems.filter((item) => {
			const fulfilledEventName = item.fulfilledEventKey
				? eventNameByKey.get(item.fulfilledEventKey)
				: null;
			return [
				fulfilledEventName,
				item.eventName,
				item.fulfilledEventKey,
				item.customerEmail,
				item.customerName,
				item.packageKey,
				item.notes,
			]
				.filter((value): value is string => typeof value === "string")
				.some((value) => value.toLowerCase().includes(needle));
		});
	}, [activationSearchTerm, eventNameByKey, reportFilteredItems]);
	const visibleItems = useMemo(
		() => filteredItems.slice(0, activationVisibleLimit),
		[activationVisibleLimit, filteredItems],
	);
	const activeFilterCount = [
		activationSearchTerm.trim().length > 0,
		activeStatus === "activated" && fulfilledReportFilter !== "all",
	].filter(Boolean).length;
	const hasQueueActionNote = queueActionNote.trim().length > 0;
	const clearQueueFilters = () => {
		setActivationSearchTerm("");
		setFulfilledReportFilter("all");
		setActivationVisibleLimit(LIST_LIMIT_OPTIONS[1]);
	};
	const statusMetricItems = STATUS_ORDER.map((status) => ({
		status,
		label: STATUS_SUMMARY_LABEL[status],
		count: metrics[status],
	}));
	const emptyItemsMessage =
		statusItems.length === 0
			? `No ${STATUS_SUMMARY_LABEL[activeStatus].toLowerCase()} activation items.`
			: "No activation items match the current search or report type.";

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Paid Placements</CardTitle>
						<CardDescription>
							Fulfill Stripe orders, schedule Spotlight or Promoted placement,
							and create private partner stats reports for selected windows.
						</CardDescription>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => void loadDashboard()}
						disabled={isLoading || isMutating}
					>
						{isLoading ? "Refreshing..." : "Refresh"}
					</Button>
				</div>

				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					{statusMetricItems.map((item) => (
						<button
							key={item.status}
							type="button"
							onClick={() => {
								setActiveStatus(item.status);
								setActivationVisibleLimit(LIST_LIMIT_OPTIONS[1]);
							}}
							disabled={isLoading || isMutating}
							className={`rounded-md border bg-background/60 px-3 py-2 text-left transition-colors hover:border-foreground/30 hover:bg-muted/35 disabled:cursor-default disabled:opacity-60 ${
								activeStatus === item.status
									? "border-foreground/40 bg-muted/40"
									: ""
							}`}
						>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								{item.label}
							</p>
							<p className="mt-1 text-sm font-medium">{item.count}</p>
							<p className="mt-0.5 text-[11px] text-muted-foreground">
								{STATUS_CARD_HINT[item.status]}
							</p>
						</button>
					))}
				</div>

				<div className="rounded-md border bg-background/60 p-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
								Manual Partner Stats Report
							</p>
							<p className="mt-1 max-w-2xl text-xs text-muted-foreground">
								Create a private stats link for an event and campaign window.
								Metrics only include activity inside the selected window; this
								does not schedule a placement or use Stripe. Created reports
								appear under Fulfilled / Reports.
							</p>
						</div>
						<Badge variant="outline">Windowed Report</Badge>
					</div>
					<div className="mt-3 grid gap-2 md:grid-cols-4">
						<div className="space-y-1 md:col-span-2">
							<label className="text-xs text-muted-foreground">Event key</label>
							<input
								list="partner-activation-event-keys"
								className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
								value={testLinkInput.eventKey}
								onChange={(event) =>
									updateTestLinkInput({
										...testLinkInput,
										eventKey: event.target.value,
									})
								}
							/>
							{selectedManualReportEvent ? (
								<p className="text-[11px] text-muted-foreground">
									{selectedManualReportEvent.name}
								</p>
							) : null}
						</div>
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">Tier</label>
							<select
								className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
								value={testLinkInput.tier}
								onChange={(event) =>
									updateTestLinkInput({
										...testLinkInput,
										tier: event.target.value as "spotlight" | "promoted",
									})
								}
							>
								<option value="spotlight">Spotlight</option>
								<option value="promoted">Promoted</option>
							</select>
						</div>
						<div className="space-y-1">
							<label className="text-xs text-muted-foreground">
								Duration (h)
							</label>
							<input
								type="number"
								min={1}
								max={168}
								className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
								value={testLinkInput.durationHours}
								onChange={(event) =>
									updateTestLinkInput({
										...testLinkInput,
										durationHours: event.target.value,
									})
								}
							/>
						</div>
						<div className="space-y-1 md:col-span-4">
							<label className="text-xs text-muted-foreground">
								Window presets
							</label>
							<div className="flex flex-wrap gap-1.5">
								{WINDOW_PRESETS.map((preset) => (
									<Button
										key={preset.key}
										type="button"
										size="sm"
										variant="outline"
										onClick={() => handleApplyWindowPreset(preset)}
									>
										{preset.label}
									</Button>
								))}
							</div>
						</div>
						<div className="space-y-1 md:col-span-2">
							<label className="text-xs text-muted-foreground">Start</label>
							<input
								type="datetime-local"
								className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
								value={testLinkInput.scheduleAt}
								onChange={(event) =>
									updateTestLinkInput({
										...testLinkInput,
										scheduleAt: event.target.value,
									})
								}
							/>
						</div>
						<div className="flex flex-wrap items-end gap-2 md:col-span-2">
							<Button
								size="sm"
								disabled={isMutating || !canUseManualReportWindow}
								variant="outline"
								onClick={() => void handlePreviewReport()}
							>
								Preview stats
							</Button>
							<Button
								size="sm"
								disabled={isMutating || !canUseManualReportWindow}
								onClick={() => void handleGenerateTestLink()}
							>
								Create private report
							</Button>
						</div>
					</div>
					<div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
						<p>
							Report window:{" "}
							<span className="font-medium text-foreground">
								{testLinkInput.scheduleAt
									? formatReportDateTime(new Date(testLinkInput.scheduleAt))
									: "Choose a start time"}
							</span>
							{" - "}
							<span className="font-medium text-foreground">
								{reportEndDate
									? formatReportDateTime(reportEndDate)
									: "Choose a valid duration"}
							</span>
						</p>
						<p className="mt-1">
							Use a past start time to include existing promo activity, or "From
							Now" for a new campaign that has not gathered stats yet.
						</p>
					</div>
					{previewPayload?.success ? (
						<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
							<div className="rounded-md border bg-background/70 px-3 py-2">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Views
								</p>
								<p className="mt-1 text-sm font-medium">
									{previewPayload.metrics.clickCount}
								</p>
							</div>
							<div className="rounded-md border bg-background/70 px-3 py-2">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Outbound
								</p>
								<p className="mt-1 text-sm font-medium">
									{previewPayload.metrics.outboundClickCount}
								</p>
							</div>
							<div className="rounded-md border bg-background/70 px-3 py-2">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Calendar
								</p>
								<p className="mt-1 text-sm font-medium">
									{previewPayload.metrics.calendarSyncCount}
								</p>
							</div>
							<div className="rounded-md border bg-background/70 px-3 py-2">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Sessions
								</p>
								<p className="mt-1 text-sm font-medium">
									{previewPayload.metrics.uniqueSessionCount}
								</p>
							</div>
							<div className="rounded-md border bg-background/70 px-3 py-2">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Outbound CVR
								</p>
								<p className="mt-1 text-sm font-medium">
									{formatPercent(previewPayload.metrics.outboundSessionRate)}
								</p>
							</div>
							<div className="rounded-md border bg-background/70 px-3 py-2">
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Calendar CVR
								</p>
								<p className="mt-1 text-sm font-medium">
									{formatPercent(previewPayload.metrics.calendarSessionRate)}
								</p>
							</div>
						</div>
					) : null}
					{generatedTestLink ? (
						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								size="sm"
								variant="outline"
								nativeButton={false}
								render={
									<a
										href={generatedTestLink}
										target="_blank"
										rel="noreferrer"
									/>
								}
							>
								Open private report
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleCopyStatsLink(generatedTestLink)}
							>
								Copy private report link
							</Button>
						</div>
					) : null}
				</div>

				{statusMessage && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
						{statusMessage}
					</div>
				)}
				{errorMessage && (
					<div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
						{errorMessage}
					</div>
				)}
			</CardHeader>

			<CardContent className="space-y-3">
				<div className="flex flex-wrap items-end justify-between gap-2">
					<div className="min-w-[220px] flex-1 space-y-1">
						<label
							htmlFor="partner-activation-search"
							className="text-xs text-muted-foreground"
						>
							Search current tab
						</label>
						<input
							id="partner-activation-search"
							type="text"
							className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
							value={activationSearchTerm}
							onChange={(event) => setActivationSearchTerm(event.target.value)}
							placeholder="Event, key, email, package"
						/>
					</div>
					<div className="flex items-center gap-2">
						{activeStatus === "activated" ? (
							<>
								<label
									htmlFor="partner-activation-report-filter"
									className="text-xs text-muted-foreground"
								>
									Type
								</label>
								<select
									id="partner-activation-report-filter"
									className="h-8 rounded-md border border-border bg-background px-2 text-xs"
									value={fulfilledReportFilter}
									onChange={(event) =>
										setFulfilledReportFilter(
											event.target.value as FulfilledReportFilter,
										)
									}
								>
									{FULFILLED_REPORT_FILTERS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</>
						) : null}
						<label
							htmlFor="partner-activation-limit"
							className="text-xs text-muted-foreground"
						>
							Show
						</label>
						<select
							id="partner-activation-limit"
							className="h-8 rounded-md border border-border bg-background px-2 text-xs"
							value={activationVisibleLimit}
							onChange={(event) =>
								setActivationVisibleLimit(
									Number.parseInt(event.target.value, 10),
								)
							}
						>
							{LIST_LIMIT_OPTIONS.map((limit) => (
								<option key={limit} value={limit}>
									{limit}
								</option>
							))}
						</select>
					</div>
				</div>
				<p className="text-xs text-muted-foreground">
					Showing {Math.min(visibleItems.length, filteredItems.length)} of{" "}
					{filteredItems.length} matching items in{" "}
					{STATUS_LABEL[activeStatus].toLowerCase()}.
				</p>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span className="font-medium text-foreground">
						Current view: {STATUS_LABEL[activeStatus]}
					</span>
					{activeFilterCount > 0 ? (
						<>
							<Badge variant="outline">
								{activeFilterCount} active filter
								{activeFilterCount === 1 ? "" : "s"}
							</Badge>
							{activationSearchTerm.trim() ? (
								<Badge variant="outline">
									Search: {activationSearchTerm.trim()}
								</Badge>
							) : null}
							{activeStatus === "activated" &&
							fulfilledReportFilter !== "all" ? (
								<Badge variant="outline">
									Type:{" "}
									{
										FULFILLED_REPORT_FILTERS.find(
											(option) => option.value === fulfilledReportFilter,
										)?.label
									}
								</Badge>
							) : null}
							<Button
								type="button"
								size="sm"
								variant="ghost"
								className="h-7 px-2 text-xs"
								onClick={clearQueueFilters}
							>
								Clear filters
							</Button>
						</>
					) : (
						<span>No search or type filters applied.</span>
					)}
				</div>
				<label className="block text-xs font-medium text-muted-foreground">
					Queue action note
					<textarea
						value={queueActionNote}
						onChange={(event) => setQueueActionNote(event.target.value)}
						placeholder="Required before dismissing, reopening, restoring, marking in progress, or changing partner report links"
						rows={2}
						className="mt-1 min-h-16 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40"
					/>
				</label>
				{filteredItems.length === 0 ? (
					<div className="rounded-md border bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
						{emptyItemsMessage}
					</div>
				) : (
					<div className="max-h-[52rem] space-y-3 overflow-y-auto pr-1">
						{visibleItems.map((item) => {
							const input = fulfillmentInputs[item.id] ?? {
								eventKey: item.fulfilledEventKey ?? "",
								tier:
									item.fulfilledTier ??
									inferTierFromPackageKey(item.packageKey),
								scheduleAt: defaultScheduleAt(),
								durationHours: "48",
							};
							const isStatsLinkRevoked = Boolean(item.partnerStatsRevokedAt);
							const statsPath = item.partnerStatsToken
								? toPartnerStatsPath(item.id, item.partnerStatsToken)
								: null;
							const fulfilledEventName = item.fulfilledEventKey
								? eventNameByKey.get(item.fulfilledEventKey)
								: null;
							const displayEventName =
								fulfilledEventName ||
								item.eventName ||
								"Event name not provided";
							const isSchedulerReport =
								item.packageKey?.startsWith("scheduler-report-") === true;
							const isManualReport =
								item.packageKey?.startsWith("manual-test-") === true;
							const canFulfill =
								item.status === "pending" || item.status === "processing";
							const canSubmitFulfillment =
								canFulfill && isReportWindowInputReady(input);
							const canMarkInProgress = item.status === "pending";
							const canReopen = item.status === "activated";
							const canDismiss = item.status !== "dismissed";
							const canRestore = item.status === "dismissed";
							const reportDuration =
								item.fulfilledStartAt && item.fulfilledEndAt
									? formatDuration(item.fulfilledStartAt, item.fulfilledEndAt)
									: null;

							return (
								<div
									key={item.id}
									id={`partner-activation-${item.id}`}
									className="rounded-md border bg-background/60 p-3"
								>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="text-sm font-medium">{displayEventName}</p>
											<div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
												<span>{item.customerEmail || "No customer email"}</span>
												<span aria-hidden="true">•</span>
												<span>{item.packageKey || "unmapped-package"}</span>
												{isManualReport ? (
													<Badge variant="outline">Manual Report</Badge>
												) : null}
												{isSchedulerReport ? (
													<Badge variant="outline">Scheduler Report</Badge>
												) : null}
												{isStatsLinkRevoked ? (
													<Badge variant="outline">Link Revoked</Badge>
												) : null}
											</div>
										</div>
										<Badge variant="outline">{STATUS_LABEL[item.status]}</Badge>
									</div>

									<div className="mt-2 text-xs text-muted-foreground">
										<p>
											Amount:{" "}
											{item.amountTotalCents != null
												? `${(item.amountTotalCents / 100).toFixed(2)} ${item.currency?.toUpperCase() || ""}`
												: "n/a"}
										</p>
										<p>Created: {formatAdminDateTime(item.createdAt)}</p>
										{item.fulfilledEventKey ? (
											<p>
												Fulfilled:{" "}
												{fulfilledEventName ? `${fulfilledEventName} • ` : ""}
												<span className="font-mono">
													{item.fulfilledEventKey}
												</span>{" "}
												• {item.fulfilledTier || "unknown tier"}
											</p>
										) : null}
										{item.fulfilledStartAt && item.fulfilledEndAt ? (
											<p>
												Report window:{" "}
												<span className="font-medium text-foreground">
													{formatReportDateTime(item.fulfilledStartAt)} -{" "}
													{formatReportDateTime(item.fulfilledEndAt)}
												</span>
												{reportDuration ? ` (${reportDuration})` : ""}
											</p>
										) : null}
										{item.activatedAt ? (
											<p>Activated: {formatAdminDateTime(item.activatedAt)}</p>
										) : null}
										{item.partnerStatsRevokedAt ? (
											<p>
												Partner link revoked:{" "}
												{formatAdminDateTime(item.partnerStatsRevokedAt)}
											</p>
										) : null}
									</div>

									{canFulfill ? (
										<div className="mt-3 grid gap-2 md:grid-cols-2">
											<div className="space-y-1">
												<label className="text-xs text-muted-foreground">
													Event key
												</label>
												<input
													list="partner-activation-event-keys"
													className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
													value={input.eventKey}
													onChange={(event) =>
														setFulfillmentInputs((current) => ({
															...current,
															[item.id]: {
																...input,
																eventKey: event.target.value,
															},
														}))
													}
												/>
											</div>
											<div className="space-y-1">
												<label className="text-xs text-muted-foreground">
													Tier
												</label>
												<select
													className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
													value={input.tier}
													onChange={(event) =>
														setFulfillmentInputs((current) => ({
															...current,
															[item.id]: {
																...input,
																tier: event.target.value as
																	| "spotlight"
																	| "promoted",
															},
														}))
													}
												>
													<option value="spotlight">Spotlight</option>
													<option value="promoted">Promoted</option>
												</select>
											</div>
											<div className="space-y-1">
												<label className="text-xs text-muted-foreground">
													Start
												</label>
												<input
													type="datetime-local"
													className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
													value={input.scheduleAt}
													onChange={(event) =>
														setFulfillmentInputs((current) => ({
															...current,
															[item.id]: {
																...input,
																scheduleAt: event.target.value,
															},
														}))
													}
												/>
											</div>
											<div className="space-y-1">
												<label className="text-xs text-muted-foreground">
													Duration (h)
												</label>
												<input
													type="number"
													min={1}
													max={168}
													className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
													value={input.durationHours}
													onChange={(event) =>
														setFulfillmentInputs((current) => ({
															...current,
															[item.id]: {
																...input,
																durationHours: event.target.value,
															},
														}))
													}
												/>
											</div>
										</div>
									) : null}

									<div className="mt-3 flex flex-wrap gap-2">
										{canFulfill ? (
											<Button
												size="sm"
												disabled={
													(isMutating && busyId === item.id) ||
													!canSubmitFulfillment
												}
												onClick={() => void handleFulfill(item.id)}
											>
												Fulfill as selected tier
											</Button>
										) : null}
										{canMarkInProgress ? (
											<Button
												size="sm"
												variant="outline"
												disabled={
													(isMutating && busyId === item.id) ||
													!hasQueueActionNote
												}
												title={
													hasQueueActionNote
														? "Mark this paid order in progress"
														: "Add a queue action note before changing status"
												}
												onClick={() => void withMutation(item.id, "processing")}
											>
												Mark in progress
											</Button>
										) : null}
										{canDismiss ? (
											<Button
												size="sm"
												variant="outline"
												disabled={
													(isMutating && busyId === item.id) ||
													!hasQueueActionNote
												}
												title={
													hasQueueActionNote
														? "Dismiss this queue item"
														: "Add a queue action note before dismissing"
												}
												onClick={() => void handleDismiss(item)}
											>
												Dismiss
											</Button>
										) : null}
										{canReopen ? (
											<Button
												size="sm"
												variant="outline"
												disabled={
													(isMutating && busyId === item.id) ||
													!hasQueueActionNote
												}
												title={
													hasQueueActionNote
														? "Reopen this fulfilled item as in progress"
														: "Add a queue action note before reopening"
												}
												onClick={() => void withMutation(item.id, "processing")}
											>
												Reopen as in progress
											</Button>
										) : null}
										{canRestore ? (
											<Button
												size="sm"
												variant="outline"
												disabled={
													(isMutating && busyId === item.id) ||
													!hasQueueActionNote
												}
												title={
													hasQueueActionNote
														? "Restore this dismissed item to the fulfillment queue"
														: "Add a queue action note before restoring"
												}
												onClick={() => void withMutation(item.id, "pending")}
											>
												Restore to needs fulfillment
											</Button>
										) : null}
										{statsPath && !isStatsLinkRevoked ? (
											<>
												<Button
													size="sm"
													variant="outline"
													nativeButton={false}
													render={
														<a
															href={statsPath}
															target="_blank"
															rel="noreferrer"
														/>
													}
												>
													Open partner stats
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={() => handleCopyStatsLink(statsPath)}
												>
													Copy stats link
												</Button>
												<Button
													size="sm"
													variant="outline"
													disabled={
														(isMutating && busyId === item.id) ||
														!hasQueueActionNote
													}
													title={
														hasQueueActionNote
															? "Revoke this partner report link"
															: "Add a queue action note before revoking this link"
													}
													onClick={() => void handleRevokeStatsLink(item.id)}
												>
													Revoke link
												</Button>
											</>
										) : null}
										{statsPath && isStatsLinkRevoked ? (
											<Button
												size="sm"
												variant="outline"
												disabled={
													(isMutating && busyId === item.id) ||
													!hasQueueActionNote
												}
												title={
													hasQueueActionNote
														? "Generate a new partner report link"
														: "Add a queue action note before regenerating this link"
												}
												onClick={() => void handleRegenerateStatsLink(item.id)}
											>
												Regenerate partner link
											</Button>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				)}
				{filteredItems.length > visibleItems.length ? (
					<div className="flex justify-center">
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() =>
								setActivationVisibleLimit((current) =>
									Math.min(current + 10, filteredItems.length),
								)
							}
						>
							Show 10 more
						</Button>
					</div>
				) : null}
				<datalist id="partner-activation-event-keys">
					{events.map((event) => (
						<option key={event.eventKey} value={event.eventKey}>
							{event.name}
						</option>
					))}
				</datalist>
			</CardContent>
		</Card>
	);
};
