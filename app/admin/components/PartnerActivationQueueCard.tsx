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
	getPartnerActivationDashboard,
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

const STATUS_LABEL: Record<PartnerActivationStatus, string> = {
	pending: "Pending",
	processing: "Processing",
	activated: "Activated",
	dismissed: "Dismissed",
};

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
	const [fulfillmentInputs, setFulfillmentInputs] = useState<
		Record<string, FulfillmentInput>
	>({});

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
							eventKey: "",
							tier: inferTierFromPackageKey(item.packageKey),
							scheduleAt: defaultScheduleAt(),
							durationHours: item.packageKey?.includes("takeover")
								? "48"
								: "48",
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
							eventKey: "",
							tier: inferTierFromPackageKey(item.packageKey),
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
				setStatusMessage(result.message);
				await loadDashboard();
			} finally {
				setIsMutating(false);
				setBusyId(null);
			}
		},
		[fulfillmentInputs, loadDashboard],
	);

	const items = useMemo(() => {
		if (!payload?.success) return [];
		return payload.items.filter((item) => item.status === activeStatus);
	}, [activeStatus, payload]);

	const metrics = payload?.success
		? payload.metrics
		: { total: 0, pending: 0, processing: 0, activated: 0, dismissed: 0 };
	const events = payload?.success ? payload.events : [];

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Partner Activation Queue</CardTitle>
						<CardDescription>
							Paid Stripe orders land here for fulfillment. Activate each order
							as either Spotlight or Promoted.
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
							Pending
						</p>
						<p className="mt-1 text-sm font-medium">{metrics.pending}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Processing
						</p>
						<p className="mt-1 text-sm font-medium">{metrics.processing}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Activated
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

			<CardContent>
				{items.length === 0 ? (
					<div className="rounded-md border bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
						No {STATUS_LABEL[activeStatus].toLowerCase()} activation items.
					</div>
				) : (
					<div className="space-y-3">
						{items.map((item) => {
							const input = fulfillmentInputs[item.id] ?? {
								eventKey: "",
								tier: inferTierFromPackageKey(item.packageKey),
								scheduleAt: defaultScheduleAt(),
								durationHours: "48",
							};
							return (
								<div
									key={item.id}
									className="rounded-md border bg-background/60 p-3"
								>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="text-sm font-medium">
												{item.eventName || "Event name not provided"}
											</p>
											<p className="text-xs text-muted-foreground">
												{item.customerEmail || "No customer email"} •{" "}
												{item.packageKey || "unmapped-package"}
											</p>
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
									</div>

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

									<div className="mt-3 flex flex-wrap gap-2">
										<Button
											size="sm"
											disabled={isMutating && busyId === item.id}
											onClick={() => void handleFulfill(item.id)}
										>
											Fulfill & activate
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={isMutating && busyId === item.id}
											onClick={() => void withMutation(item.id, "processing")}
										>
											Mark processing
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={isMutating && busyId === item.id}
											onClick={() => void withMutation(item.id, "dismissed")}
										>
											Dismiss
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}
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
