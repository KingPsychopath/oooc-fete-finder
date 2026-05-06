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
	acceptEventSubmission,
	declineEventSubmission,
	getEventSubmissionsDashboard,
	updateEventSubmissionEnabled,
} from "@/features/events/submissions/actions";
import {
	EVENT_SUBMISSION_DECLINE_REASONS,
	type EventSubmissionDeclineReason,
	type EventSubmissionRecord,
	type EventSubmissionStatus,
} from "@/features/events/submissions/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const STATUS_TABS: Array<{ key: EventSubmissionStatus; label: string }> = [
	{ key: "pending", label: "Pending" },
	{ key: "accepted", label: "Accepted" },
	{ key: "declined", label: "Declined" },
];

const DECLINE_REASON_LABELS: Record<EventSubmissionDeclineReason, string> = {
	not_enough_information: "Not enough information",
	duplicate_submission: "Duplicate submission",
	event_not_relevant: "Event not relevant",
	unable_to_verify: "Unable to verify",
	spam_signal: "Spam signal",
	other: "Other",
};

type EventUpdateSnapshotKey = keyof NonNullable<
	EventSubmissionRecord["payload"]["originalEventSnapshot"]
>;

const parseDisplayLinks = (value: string | undefined): string[] =>
	(value || "")
		.split(/[,\n\r|]/)
		.map((link) => link.trim())
		.filter(Boolean);

type SubmissionSettingKey = "new_events" | "event_updates";

type DashboardPayload = Awaited<
	ReturnType<typeof getEventSubmissionsDashboard>
>;

const getSubmissionRowsByStatus = (
	payload: DashboardPayload | null,
	status: EventSubmissionStatus,
): EventSubmissionRecord[] => {
	if (!payload?.success) return [];
	switch (status) {
		case "pending":
			return payload.pending;
		case "accepted":
			return payload.accepted;
		case "declined":
			return payload.declined;
		default:
			return [];
	}
};

export const EventSubmissionsCard = ({
	initialPayload,
	onSubmissionReviewed,
}: {
	initialPayload?: DashboardPayload;
	onSubmissionReviewed?: () => Promise<void> | void;
}) => {
	const [payload, setPayload] = useState<DashboardPayload | null>(
		initialPayload ?? null,
	);
	const [activeStatus, setActiveStatus] =
		useState<EventSubmissionStatus>("pending");
	const [isLoading, setIsLoading] = useState(false);
	const [isMutating, setIsMutating] = useState(false);
	const [busySubmissionId, setBusySubmissionId] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [selectedDeclineReasonById, setSelectedDeclineReasonById] = useState<
		Record<string, EventSubmissionDeclineReason>
	>({});
	const [customDeclineReasonById, setCustomDeclineReasonById] = useState<
		Record<string, string>
	>({});

	const loadDashboard = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage("");
		try {
			const result = await getEventSubmissionsDashboard();
			setPayload(result);
			if (!result.success) {
				setErrorMessage(result.error || "Failed to load event submissions");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialPayload?.success) {
			return;
		}
		void loadDashboard();
	}, [initialPayload?.success, loadDashboard]);

	const withMutation = useCallback(
		async (
			submissionId: string,
			task: () => Promise<{
				success: boolean;
				message: string;
				error?: string;
			}>,
		) => {
			setIsMutating(true);
			setBusySubmissionId(submissionId);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await task();
				if (!result.success) {
					setErrorMessage(result.error || result.message);
					return;
				}
				setStatusMessage(result.message);
				await loadDashboard();
				if (onSubmissionReviewed) {
					await onSubmissionReviewed();
				}
			} finally {
				setIsMutating(false);
				setBusySubmissionId(null);
			}
		},
		[loadDashboard, onSubmissionReviewed],
	);

	const handleToggleSubmissions = useCallback(
		async (setting: SubmissionSettingKey) => {
			const enabled = payload?.success
				? setting === "new_events"
					? payload.settings.newEventsEnabled
					: payload.settings.eventUpdatesEnabled
				: true;
			setIsMutating(true);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await updateEventSubmissionEnabled(setting, !enabled);
				if (!result.success) {
					setErrorMessage(
						result.error || "Failed to update submission setting",
					);
					return;
				}
				setStatusMessage(result.message || "Submission setting updated");
				await loadDashboard();
				if (onSubmissionReviewed) {
					await onSubmissionReviewed();
				}
			} finally {
				setIsMutating(false);
				setBusySubmissionId(null);
			}
		},
		[loadDashboard, onSubmissionReviewed, payload],
	);

	const handleAccept = useCallback(
		async (submissionId: string) => {
			await withMutation(submissionId, () =>
				acceptEventSubmission(submissionId),
			);
		},
		[withMutation],
	);

	const handleDecline = useCallback(
		async (submissionId: string) => {
			const selectedReason =
				selectedDeclineReasonById[submissionId] ?? "not_enough_information";
			const customReason = (customDeclineReasonById[submissionId] || "").trim();
			const reason = selectedReason === "other" ? customReason : selectedReason;
			if (!reason) {
				setErrorMessage(
					"Add a decline reason before declining this submission.",
				);
				return;
			}
			await withMutation(submissionId, () =>
				declineEventSubmission(submissionId, reason),
			);
		},
		[customDeclineReasonById, selectedDeclineReasonById, withMutation],
	);

	const rows = useMemo(
		() => getSubmissionRowsByStatus(payload, activeStatus),
		[activeStatus, payload],
	);

	const tabCounts = useMemo(
		() => ({
			pending: payload?.success ? payload.pending.length : 0,
			accepted: payload?.success ? payload.accepted.length : 0,
			declined: payload?.success ? payload.declined.length : 0,
		}),
		[payload],
	);

	const metrics = payload?.success ? payload.metrics : null;
	const newEventsEnabled = payload?.success
		? payload.settings.newEventsEnabled
		: true;
	const eventUpdatesEnabled = payload?.success
		? payload.settings.eventUpdatesEnabled
		: true;
	const settingsStatus = payload?.success ? payload.settingsStatus : null;

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Event Submissions</CardTitle>
						<CardDescription>
							Host-submitted events and update requests awaiting moderation.
							Accept publishes new events; update requests are reviewed against
							the current event sheet.
						</CardDescription>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							role="switch"
							aria-checked={newEventsEnabled}
							aria-label="Toggle new event submissions"
							onClick={() => void handleToggleSubmissions("new_events")}
							disabled={isLoading || isMutating}
							className={`group inline-flex h-8 items-center gap-2 rounded-full border px-2.5 text-xs tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
								newEventsEnabled
									? "border-emerald-300 bg-emerald-50 text-emerald-900"
									: "border-rose-300 bg-rose-50 text-rose-900"
							}`}
						>
							<span
								className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
									newEventsEnabled ? "bg-emerald-500" : "bg-rose-400"
								}`}
								aria-hidden="true"
							>
								<span
									className={`absolute h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
										newEventsEnabled ? "translate-x-4" : "translate-x-0.5"
									}`}
								/>
							</span>
							<span>New events {newEventsEnabled ? "open" : "closed"}</span>
						</button>
						<button
							type="button"
							role="switch"
							aria-checked={eventUpdatesEnabled}
							aria-label="Toggle event update requests"
							onClick={() => void handleToggleSubmissions("event_updates")}
							disabled={isLoading || isMutating}
							className={`group inline-flex h-8 items-center gap-2 rounded-full border px-2.5 text-xs tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
								eventUpdatesEnabled
									? "border-emerald-300 bg-emerald-50 text-emerald-900"
									: "border-rose-300 bg-rose-50 text-rose-900"
							}`}
						>
							<span
								className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
									eventUpdatesEnabled ? "bg-emerald-500" : "bg-rose-400"
								}`}
								aria-hidden="true"
							>
								<span
									className={`absolute h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
										eventUpdatesEnabled ? "translate-x-4" : "translate-x-0.5"
									}`}
								/>
							</span>
							<span>Updates {eventUpdatesEnabled ? "open" : "closed"}</span>
						</button>
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
				</div>
				{settingsStatus && (
					<div className="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
						<p className="break-all">Store path: {settingsStatus.location}</p>
						<p className="mt-1">
							Last updated:{" "}
							{new Date(settingsStatus.updatedAt).toLocaleString()} by{" "}
							{settingsStatus.updatedBy}
						</p>
					</div>
				)}
				{!newEventsEnabled && (
					<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
						New event submissions are currently disabled. The new-event endpoint
						path is blocked.
					</div>
				)}
				{!eventUpdatesEnabled && (
					<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
						Event update requests are currently disabled. Request-update links
						are hidden and blocked.
					</div>
				)}
				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Pending
						</p>
						<p className="mt-1 text-sm font-medium">
							{metrics?.pendingCount ?? tabCounts.pending}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Accepted (7d)
						</p>
						<p className="mt-1 text-sm font-medium">
							{metrics?.acceptedLast7Days ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Declined (7d)
						</p>
						<p className="mt-1 text-sm font-medium">
							{metrics?.declinedLast7Days ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Total
						</p>
						<p className="mt-1 text-sm font-medium">
							{metrics?.totalCount ??
								tabCounts.pending + tabCounts.accepted + tabCounts.declined}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{STATUS_TABS.map((tab) => (
						<Button
							key={tab.key}
							type="button"
							size="sm"
							variant={activeStatus === tab.key ? "default" : "outline"}
							onClick={() => setActiveStatus(tab.key)}
						>
							{tab.label} ({tabCounts[tab.key]})
						</Button>
					))}
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
				{rows.length === 0 ? (
					<div className="rounded-md border bg-background/60 px-3 py-10 text-center text-sm text-muted-foreground">
						No submissions in this status.
					</div>
				) : (
					<div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
						{rows.map((submission) => {
							const selectedReason =
								selectedDeclineReasonById[submission.id] ??
								"not_enough_information";
							const customReason = customDeclineReasonById[submission.id] ?? "";
							const isBusy = isMutating && busySubmissionId === submission.id;
							const suggestedGenres =
								submission.payload.suggestedGenres?.filter(Boolean) ?? [];
							const ticketLinks = parseDisplayLinks(
								submission.payload.ticketLink,
							);
							const isUpdateRequest =
								submission.payload.submissionType === "event_update";
							const originalSnapshot =
								submission.payload.originalEventSnapshot ?? {};
							const changedFields: Array<{
								label: string;
								key: EventUpdateSnapshotKey;
								next: string;
							}> = [
								["Event", "eventName", submission.payload.eventName],
								["Date", "date", submission.payload.date],
								["Start", "startTime", submission.payload.startTime],
								["End", "endTime", submission.payload.endTime || ""],
								["Location", "location", submission.payload.location],
								["Genre", "genre", submission.payload.genre || ""],
								["Price", "price", submission.payload.price || ""],
								["Age", "age", submission.payload.age || ""],
								[
									"Venue",
									"indoorOutdoor",
									submission.payload.indoorOutdoor || "",
								],
								[
									"Arrondissement",
									"arrondissement",
									submission.payload.arrondissement || "",
								],
								[
									"Proof of change URL",
									"proofLink",
									submission.payload.proofLink,
								],
								[
									"Ticket link",
									"ticketLink",
									submission.payload.ticketLink || "",
								],
								["Notes", "notes", submission.payload.notes || ""],
							]
								.map(([label, key, next]) => ({
									label,
									key: key as EventUpdateSnapshotKey,
									next,
								}))
								.filter(({ key, next }) => {
									const previous = originalSnapshot[key] || "";
									return previous !== next;
								});

							return (
								<div
									key={submission.id}
									className="rounded-md border bg-background/60 p-3"
								>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="space-y-1">
											<p className="text-sm font-medium">
												{submission.payload.eventName}
											</p>
											<p className="text-xs text-muted-foreground">
												{submission.payload.date} at{" "}
												{submission.payload.startTime} •{" "}
												{submission.payload.location}
											</p>
											<p className="text-xs text-muted-foreground break-all">
												{submission.payload.hostEmail}
											</p>
										</div>
										<div className="flex flex-wrap gap-1.5">
											{isUpdateRequest && (
												<Badge variant="outline">Update request</Badge>
											)}
											<Badge variant="outline">{submission.status}</Badge>
											{suggestedGenres.length > 0 && (
												<Badge variant="outline">Review genre suggestion</Badge>
											)}
											{submission.spamSignals.reasons.map((reason) => (
												<Badge key={reason} variant="destructive">
													{reason}
												</Badge>
											))}
										</div>
									</div>

									<div className="mt-2 text-xs text-muted-foreground break-all">
										{isUpdateRequest ? "Proof of change" : "Proof"}:{" "}
										{submission.payload.proofLink}
									</div>
									{ticketLinks.length > 0 && (
										<div className="mt-1 text-xs text-muted-foreground">
											<p className="font-medium text-foreground/75">
												Ticket link{ticketLinks.length === 1 ? "" : "s"}:
											</p>
											<div className="mt-1 space-y-0.5">
												{ticketLinks.map((link, index) => (
													<p
														key={`${submission.id}-ticket-link-${index}-${link}`}
														className="break-all"
													>
														<span className="font-medium">
															{index === 0 ? "Primary" : `Additional ${index}`}:
														</span>{" "}
														{link}
													</p>
												))}
											</div>
										</div>
									)}

									{isUpdateRequest && (
										<div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
											<p className="font-medium">
												Update for{" "}
												{submission.payload.originalEventName ||
													submission.payload.eventName}
											</p>
											{submission.payload.originalEventKey && (
												<p className="mt-1 break-all">
													Event key: {submission.payload.originalEventKey}
												</p>
											)}
											{submission.payload.originalEventUrl && (
												<p className="mt-1 break-all">
													Canonical URL: {submission.payload.originalEventUrl}
												</p>
											)}
											{changedFields.length > 0 && (
												<div className="mt-2 space-y-1">
													<p className="font-medium">Changed fields</p>
													{changedFields.map(({ label, key, next }) => (
														<p key={key} className="break-words">
															<span className="font-medium">{label}:</span>{" "}
															<span className="whitespace-pre-wrap line-through opacity-70">
																{originalSnapshot[key] || "-"}
															</span>{" "}
															<span className="whitespace-pre-wrap">
																→ {next || "-"}
															</span>
														</p>
													))}
												</div>
											)}
										</div>
									)}

									{suggestedGenres.length > 0 && (
										<div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
											<span className="font-medium">Suggested genres:</span>{" "}
											{suggestedGenres.join(", ")}. Add or map these in Manage
											genres if they should become reusable filters.
										</div>
									)}

									<details className="mt-2 rounded-md border bg-background/80 px-3 py-2">
										<summary className="cursor-pointer text-xs font-medium text-foreground/85">
											Submission details
										</summary>
										<div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
											<div>End time: {submission.payload.endTime || "-"}</div>
											<div>Genre: {submission.payload.genre || "-"}</div>
											<div>
												Suggested genres: {suggestedGenres.join(", ") || "-"}
											</div>
											<div>Price: {submission.payload.price || "-"}</div>
											<div>Age: {submission.payload.age || "-"}</div>
											<div>
												Venue: {submission.payload.indoorOutdoor || "-"}
											</div>
											<div>
												Arrondissement:{" "}
												{submission.payload.arrondissement || "-"}
											</div>
										</div>
										{submission.payload.notes && (
											<p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
												{submission.payload.notes}
											</p>
										)}
									</details>

									<div className="mt-2 text-[11px] text-muted-foreground">
										Submitted {new Date(submission.createdAt).toLocaleString()}
										{submission.reviewedAt
											? ` • Reviewed ${new Date(submission.reviewedAt).toLocaleString()}`
											: ""}
										{submission.reviewReason
											? ` • Reason: ${submission.reviewReason}`
											: ""}
									</div>

									{submission.status === "pending" && (
										<div className="mt-3 space-y-2 rounded-md border bg-background/80 p-2.5">
											<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
												<select
													value={selectedReason}
													onChange={(event) => {
														const nextReason = event.target
															.value as EventSubmissionDeclineReason;
														setSelectedDeclineReasonById((current) => ({
															...current,
															[submission.id]: nextReason,
														}));
													}}
													className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
													disabled={isBusy}
												>
													{EVENT_SUBMISSION_DECLINE_REASONS.map((reason) => (
														<option key={reason} value={reason}>
															{DECLINE_REASON_LABELS[reason]}
														</option>
													))}
												</select>
												<div className="flex gap-2">
													<Button
														type="button"
														onClick={() => void handleAccept(submission.id)}
														disabled={isBusy || isUpdateRequest}
														size="sm"
														title={
															isUpdateRequest
																? "Apply update requests manually in the event sheet"
																: undefined
														}
													>
														{isBusy ? "Working..." : "Accept"}
													</Button>
													<Button
														type="button"
														variant="destructive"
														onClick={() => void handleDecline(submission.id)}
														disabled={isBusy}
														size="sm"
													>
														Decline
													</Button>
												</div>
											</div>
											{selectedReason === "other" && (
												<input
													type="text"
													value={customReason}
													onChange={(event) =>
														setCustomDeclineReasonById((current) => ({
															...current,
															[submission.id]: event.target.value,
														}))
													}
													placeholder="Type decline reason"
													className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
													disabled={isBusy}
												/>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
