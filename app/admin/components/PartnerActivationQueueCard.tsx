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
	getPartnerActivationDashboard,
	updatePartnerActivationStatus,
} from "@/features/partners/activation-actions";
import type { PartnerActivationStatus } from "@/lib/platform/postgres/partner-activation-repository";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardPayload = Awaited<
	ReturnType<typeof getPartnerActivationDashboard>
>;

const STATUS_LABEL: Record<PartnerActivationStatus, string> = {
	pending: "Pending",
	processing: "Processing",
	activated: "Activated",
	dismissed: "Dismissed",
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

	const loadDashboard = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage("");
		try {
			const result = await getPartnerActivationDashboard();
			setPayload(result);
			if (!result.success) {
				setErrorMessage(result.error || "Failed to load activation queue");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialPayload?.success) return;
		void loadDashboard();
	}, [initialPayload?.success, loadDashboard]);

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

	const items = useMemo(() => {
		if (!payload?.success) return [];
		return payload.items.filter((item) => item.status === activeStatus);
	}, [activeStatus, payload]);

	const metrics = payload?.success
		? payload.metrics
		: { total: 0, pending: 0, processing: 0, activated: 0, dismissed: 0 };

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Partner Activation Queue</CardTitle>
						<CardDescription>
							Paid Stripe orders land here for manual activation and follow-up.
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
						{items.map((item) => (
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
									{item.eventUrl ? (
										<a
											className="underline underline-offset-4"
											href={item.eventUrl}
											target="_blank"
											rel="noopener noreferrer"
										>
											Event URL
										</a>
									) : null}
								</div>

								<div className="mt-3 flex flex-wrap gap-2">
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
										disabled={isMutating && busyId === item.id}
										onClick={() => void withMutation(item.id, "activated")}
									>
										Mark activated
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
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
