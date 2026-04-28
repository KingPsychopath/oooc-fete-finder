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
	updatePartnerActivationStatus,
} from "@/features/partners/activation-actions";
import type { PartnerActivationStatus } from "@/lib/platform/postgres/partner-activation-repository";
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

const WINDOW_PRESETS = [
	{ key: "last-48h", label: "Last 48h", hours: 48 },
	{ key: "last-7d", label: "Last 7d", hours: 168 },
	{ key: "from-now", label: "From Now", hours: 48 },
] as const;

const LIST_LIMIT_OPTIONS = [5, 10, 20, 50] as const;

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

const formatReportDateTime = (value: Date | string): string =>
	new Date(value).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

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
	const [activeStatus, setActiveStatus] =
		useState<PartnerActivationStatus>("pending");
	const [busyId, setBusyId] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [activationSearchTerm, setActivationSearchTerm] = useState("");
	const [activationVisibleLimit, setActivationVisibleLimit] = useState<number>(
		LIST_LIMIT_OPTIONS[1],
	);
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

	const withMutation = useCallback(
		async (id: string, status: PartnerActivationStatus) => {
			setIsMutating(true);
			setBusyId(id);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await updatePartnerActivationStatus({ id, status });
				if (!result.success) {
					setErrorMessage(result.error || result.message);
					return;
				}
				setStatusMessage(result.message);
				await loadDashboard();
			} finally {
				setIsMutating(false);
				setBusyId(null);
			}
		},
		[loadDashboard],
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
			if (!input || !input.eventKey.trim()) {
				setErrorMessage(
					"Select an event key before fulfilling this activation.",
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

	const updateTestLinkInput = useCallback((nextInput: TestLinkInput) => {
		setPreviewPayload(null);
		setGeneratedTestLink(null);
		setTestLinkInput(nextInput);
	}, []);

	const handleGenerateTestLink = useCallback(async () => {
		if (!testLinkInput.eventKey.trim()) {
			setErrorMessage("Select an event key to create a manual stats report.");
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
		if (!testLinkInput.eventKey.trim()) {
			setErrorMessage("Select an event key before previewing stats.");
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
	const filteredItems = useMemo(() => {
		const needle = activationSearchTerm.trim().toLowerCase();
		if (!needle) return statusItems;
		return statusItems.filter((item) => {
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
	}, [activationSearchTerm, eventNameByKey, statusItems]);
	const visibleItems = useMemo(
		() => filteredItems.slice(0, activationVisibleLimit),
		[activationVisibleLimit, filteredItems],
	);

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
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Needs Fulfillment
						</p>
						<p className="mt-1 text-sm font-medium">{metrics.pending}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							In Progress
						</p>
						<p className="mt-1 text-sm font-medium">{metrics.processing}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Fulfilled
						</p>
						<p className="mt-1 text-sm font-medium">{metrics.activated}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Dismissed
						</p>
						<p className="mt-1 text-sm font-medium">{metrics.dismissed}</p>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{(["pending", "processing", "activated", "dismissed"] as const).map(
						(status) => (
							<Button
								key={status}
								type="button"
								size="sm"
								variant={activeStatus === status ? "default" : "outline"}
								onClick={() => setActiveStatus(status)}
							>
								{STATUS_LABEL[status]}
							</Button>
						),
					)}
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
								disabled={isMutating}
								variant="outline"
								onClick={() => void handlePreviewReport()}
							>
								Preview stats
							</Button>
							<Button
								size="sm"
								disabled={isMutating}
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
				{filteredItems.length === 0 ? (
					<div className="rounded-md border bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
						No {STATUS_SUMMARY_LABEL[activeStatus].toLowerCase()} activation
						items match this view.
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
							const statsPath =
								item.partnerStatsToken && item.status === "activated"
									? toPartnerStatsPath(item.id, item.partnerStatsToken)
									: null;
							const fulfilledEventName = item.fulfilledEventKey
								? eventNameByKey.get(item.fulfilledEventKey)
								: null;
							const displayEventName =
								fulfilledEventName ||
								item.eventName ||
								"Event name not provided";
							const isManualReport =
								item.packageKey?.startsWith("manual-test-") === true;
							const canFulfill =
								item.status === "pending" || item.status === "processing";
							const canMarkInProgress = item.status === "pending";
							const canReopen = item.status === "activated";
							const canDismiss = item.status !== "dismissed";
							const canRestore = item.status === "dismissed";

							return (
								<div
									key={item.id}
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
										<p>Created: {new Date(item.createdAt).toLocaleString()}</p>
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
												disabled={isMutating && busyId === item.id}
												onClick={() => void handleFulfill(item.id)}
											>
												Fulfill as selected tier
											</Button>
										) : null}
										{canMarkInProgress ? (
											<Button
												size="sm"
												variant="outline"
												disabled={isMutating && busyId === item.id}
												onClick={() => void withMutation(item.id, "processing")}
											>
												Mark in progress
											</Button>
										) : null}
										{canDismiss ? (
											<Button
												size="sm"
												variant="outline"
												disabled={isMutating && busyId === item.id}
												onClick={() => void handleDismiss(item)}
											>
												Dismiss
											</Button>
										) : null}
										{canReopen ? (
											<Button
												size="sm"
												variant="outline"
												disabled={isMutating && busyId === item.id}
												onClick={() => void withMutation(item.id, "processing")}
											>
												Reopen as in progress
											</Button>
										) : null}
										{canRestore ? (
											<Button
												size="sm"
												variant="outline"
												disabled={isMutating && busyId === item.id}
												onClick={() => void withMutation(item.id, "pending")}
											>
												Restore to needs fulfillment
											</Button>
										) : null}
										{statsPath ? (
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
											</>
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
