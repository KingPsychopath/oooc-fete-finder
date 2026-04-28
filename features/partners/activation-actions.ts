"use server";

import { randomUUID } from "crypto";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import {
	listFeaturedQueue,
	scheduleFeaturedEvent,
} from "@/features/events/featured/actions";
import {
	listPromotedQueue,
	schedulePromotedEvent,
} from "@/features/events/promoted/actions";
import { env } from "@/lib/config/env";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import {
	type PartnerActivationRecord,
	type PartnerActivationStatus,
	type PartnerPlacementTier,
	getPartnerActivationRepository,
} from "@/lib/platform/postgres/partner-activation-repository";

const assertAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) {
		throw new Error("Unauthorized access");
	}
};

const toPercent = (numerator: number, denominator: number): number => {
	if (denominator <= 0) return 0;
	return Math.round((numerator / denominator) * 1000) / 10;
};

const buildReportWindow = (input: {
	requestedStartAt?: string;
	durationHours?: number;
}): {
	startAt: string;
	endAt: string;
	durationHours: number;
} => {
	const startDate =
		input.requestedStartAt && input.requestedStartAt.trim().length > 0
			? new Date(input.requestedStartAt)
			: new Date();
	const safeStartDate = Number.isFinite(startDate.getTime())
		? startDate
		: new Date();
	const parsedDuration =
		typeof input.durationHours === "number"
			? Math.floor(input.durationHours)
			: 48;
	const safeDuration = Number.isFinite(parsedDuration) ? parsedDuration : 48;
	const durationHours = Math.max(1, Math.min(168, safeDuration));
	const endDate = new Date(
		safeStartDate.getTime() + durationHours * 60 * 60 * 1000,
	);

	return {
		startAt: safeStartDate.toISOString(),
		endAt: endDate.toISOString(),
		durationHours,
	};
};

const toIsoTimestamp = (value: string): string | null => {
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) return null;
	return parsed.toISOString();
};

const toReportPath = (record: PartnerActivationRecord): string | null => {
	if (!record.partnerStatsToken || record.partnerStatsRevokedAt) return null;
	return (
		env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") +
		`${env.NEXT_PUBLIC_BASE_PATH}/partner-stats/${record.id}?token=${record.partnerStatsToken}`
	);
};

const toPlacementReportKey = (input: {
	eventKey: string;
	tier: PartnerPlacementTier;
	startAt: string;
	endAt: string;
}): string => `${input.eventKey}|${input.tier}|${input.startAt}|${input.endAt}`;

export async function getPartnerActivationDashboard(): Promise<
	| {
			success: true;
			items: Awaited<
				ReturnType<
					NonNullable<
						ReturnType<typeof getPartnerActivationRepository>
					>["listRecent"]
				>
			>;
			metrics: Awaited<
				ReturnType<
					NonNullable<
						ReturnType<typeof getPartnerActivationRepository>
					>["metrics"]
				>
			>;
			events: Array<{
				eventKey: string;
				name: string;
				date: string;
				time: string;
			}>;
	  }
	| {
			success: false;
			error: string;
	  }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return { success: false, error: "Postgres not configured" };
		}
		const [items, metrics] = await Promise.all([
			repository.listRecent(120),
			repository.metrics(),
		]);
		const eventsResult = await getLiveEvents({
			includeFeaturedProjection: false,
			includeEngagementProjection: false,
		});
		const events = eventsResult.success
			? [...eventsResult.data]
					.sort((left, right) => left.name.localeCompare(right.name))
					.map((event) => ({
						eventKey: event.eventKey,
						name: event.name,
						date: event.date,
						time: event.time || "",
					}))
			: [];
		return { success: true, items, metrics, events };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown partner activation error",
		};
	}
}

export async function fulfillPartnerActivation(input: {
	activationId: string;
	eventKey: string;
	tier: "spotlight" | "promoted";
	requestedStartAt?: string;
	durationHours?: number;
}): Promise<
	| { success: true; message: string; statsPath: string | null }
	| { success: false; message: string; error: string }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return {
				success: false,
				message: "Postgres not configured",
				error: "Postgres not configured",
			};
		}
		if (!input.eventKey.trim()) {
			return {
				success: false,
				message: "Event key is required",
				error: "Event key is required",
			};
		}
		const scheduleResult =
			input.tier === "spotlight"
				? await scheduleFeaturedEvent(
						input.eventKey,
						input.requestedStartAt ?? "",
						input.durationHours,
					)
				: await schedulePromotedEvent(
						input.eventKey,
						input.requestedStartAt ?? "",
						input.durationHours,
					);
		if (!scheduleResult.success) {
			return {
				success: false,
				message: scheduleResult.message,
				error: scheduleResult.error || scheduleResult.message,
			};
		}
		const reportWindow = buildReportWindow({
			requestedStartAt: input.requestedStartAt,
			durationHours: input.durationHours,
		});

		let effectiveStartAt = reportWindow.startAt;
		let effectiveEndAt = reportWindow.endAt;
		if (input.tier === "spotlight") {
			const queue = await listFeaturedQueue();
			if (queue.success) {
				const match = queue.queue
					?.filter(
						(row) =>
							row.eventKey === input.eventKey && row.status === "scheduled",
					)
					.sort(
						(left, right) =>
							new Date(right.requestedStartAt).getTime() -
							new Date(left.requestedStartAt).getTime(),
					)[0];
				if (match) {
					effectiveStartAt = match.effectiveStartAt;
					effectiveEndAt = match.effectiveEndAt;
				}
			}
		} else {
			const queue = await listPromotedQueue();
			if (queue.success) {
				const match = queue.queue
					?.filter(
						(row) =>
							row.eventKey === input.eventKey && row.status === "scheduled",
					)
					.sort(
						(left, right) =>
							new Date(right.requestedStartAt).getTime() -
							new Date(left.requestedStartAt).getTime(),
					)[0];
				if (match) {
					effectiveStartAt = match.effectiveStartAt;
					effectiveEndAt = match.effectiveEndAt;
				}
			}
		}
		const partnerStatsToken = randomUUID().replace(/-/g, "");

		const updated = await repository.markFulfilled({
			id: input.activationId,
			eventKey: input.eventKey,
			tier: input.tier,
			startAt: effectiveStartAt,
			endAt: effectiveEndAt,
			partnerStatsToken,
			notes: `Activated as ${input.tier} (${input.eventKey})`,
		});
		if (!updated) {
			return {
				success: false,
				message: "Activation queue item not found",
				error: "Activation queue item not found",
			};
		}

		const siteUrl =
			env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") +
			`${env.NEXT_PUBLIC_BASE_PATH}/partner-stats/${updated.id}?token=${updated.partnerStatsToken}`;

		return {
			success: true,
			message: `Activated ${input.tier} for ${input.eventKey}`,
			statsPath: siteUrl,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to fulfill activation",
			error: error instanceof Error ? error.message : "Unknown fulfill error",
		};
	}
}

export async function updatePartnerActivationStatus(input: {
	id: string;
	status: PartnerActivationStatus;
	notes?: string;
}): Promise<
	| { success: true; message: string }
	| { success: false; message: string; error: string }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return {
				success: false,
				message: "Postgres not configured",
				error: "Postgres not configured",
			};
		}
		const updated = await repository.updateStatus({
			id: input.id,
			status: input.status,
			notes: input.notes,
		});
		if (!updated) {
			return {
				success: false,
				message: "Activation queue item not found",
				error: "Activation queue item not found",
			};
		}
		return {
			success: true,
			message: `Marked item as ${input.status}`,
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to update activation queue item",
			error:
				error instanceof Error
					? error.message
					: "Unknown activation update error",
		};
	}
}

export async function revokePartnerStatsLink(input: {
	activationId: string;
}): Promise<
	| { success: true; message: string }
	| { success: false; message: string; error: string }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return {
				success: false,
				message: "Postgres not configured",
				error: "Postgres not configured",
			};
		}
		const updated = await repository.revokePartnerStats({
			id: input.activationId,
			notes: "Partner stats link revoked",
		});
		if (!updated) {
			return {
				success: false,
				message: "Activation queue item not found",
				error: "Activation queue item not found",
			};
		}
		if (!updated.partnerStatsToken) {
			return {
				success: false,
				message: "This item does not have a partner stats link to revoke",
				error: "This item does not have a partner stats link to revoke",
			};
		}
		return {
			success: true,
			message: "Partner stats link revoked",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to revoke partner stats link",
			error: error instanceof Error ? error.message : "Unknown revoke error",
		};
	}
}

export async function regeneratePartnerStatsLink(input: {
	activationId: string;
}): Promise<
	| { success: true; statsPath: string; message: string }
	| { success: false; message: string; error: string }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return {
				success: false,
				message: "Postgres not configured",
				error: "Postgres not configured",
			};
		}
		const current = await repository.findById(input.activationId);
		if (!current) {
			return {
				success: false,
				message: "Activation queue item not found",
				error: "Activation queue item not found",
			};
		}
		if (!current.fulfilledEventKey || !current.fulfilledTier) {
			return {
				success: false,
				message: "Only fulfilled reports can have partner stats links",
				error: "Only fulfilled reports can have partner stats links",
			};
		}
		const updated = await repository.regeneratePartnerStatsToken({
			id: input.activationId,
			partnerStatsToken: randomUUID().replace(/-/g, ""),
			notes: "Partner stats link regenerated",
		});
		const statsPath = updated ? toReportPath(updated) : null;
		if (!updated || !statsPath) {
			return {
				success: false,
				message: "Failed to regenerate partner stats link",
				error: "Failed to regenerate partner stats link",
			};
		}
		return {
			success: true,
			statsPath,
			message: "Partner stats link regenerated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to regenerate partner stats link",
			error:
				error instanceof Error
					? error.message
					: "Unknown partner stats regeneration error",
		};
	}
}

export async function generatePartnerStatsTestLink(input: {
	eventKey: string;
	tier: "spotlight" | "promoted";
	requestedStartAt?: string;
	durationHours?: number;
}): Promise<
	| { success: true; statsPath: string; activationId: string; message: string }
	| { success: false; message: string; error: string }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return {
				success: false,
				message: "Postgres not configured",
				error: "Postgres not configured",
			};
		}
		const trimmedEventKey = input.eventKey.trim();
		if (!trimmedEventKey) {
			return {
				success: false,
				message: "Event key is required",
				error: "Event key is required",
			};
		}

		const reportWindow = buildReportWindow({
			requestedStartAt: input.requestedStartAt,
			durationHours: input.durationHours,
		});

		const seedResult = await repository.enqueueFromStripe({
			sourceEventId: `manual-test-${randomUUID()}`,
			packageKey:
				input.tier === "promoted"
					? "manual-test-promoted"
					: "manual-test-spotlight",
			customerEmail: "internal-test@outofofficecollective.co.uk",
			customerName: "Internal Test",
			eventName: trimmedEventKey,
			notes: "Manual partner stats test link",
			metadata: {
				createdBy: "admin-manual-test",
			},
			rawPayload: {
				type: "manual.test",
				eventKey: trimmedEventKey,
			},
		});

		if (!seedResult.record) {
			return {
				success: false,
				message: "Failed to create test activation record",
				error: "Failed to create test activation record",
			};
		}

		const partnerStatsToken = randomUUID().replace(/-/g, "");
		const updated = await repository.markFulfilled({
			id: seedResult.record.id,
			eventKey: trimmedEventKey,
			tier: input.tier,
			startAt: reportWindow.startAt,
			endAt: reportWindow.endAt,
			partnerStatsToken,
			notes: `Manual test stats link (${trimmedEventKey})`,
		});

		if (!updated?.partnerStatsToken) {
			return {
				success: false,
				message: "Failed to finalize test stats link",
				error: "Failed to finalize test stats link",
			};
		}

		const statsPath =
			env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") +
			`${env.NEXT_PUBLIC_BASE_PATH}/partner-stats/${updated.id}?token=${updated.partnerStatsToken}`;

		return {
			success: true,
			statsPath,
			activationId: updated.id,
			message: "Test partner stats link generated",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to generate test stats link",
			error:
				error instanceof Error
					? error.message
					: "Unknown test stats generation error",
		};
	}
}

export async function getOrCreatePartnerReportForPlacement(input: {
	placementId: string;
	eventKey: string;
	eventName?: string;
	tier: PartnerPlacementTier;
	startAt: string;
	endAt: string;
}): Promise<
	| {
			success: true;
			statsPath: string;
			activationId: string;
			existing: boolean;
			message: string;
	  }
	| { success: false; message: string; error: string }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return {
				success: false,
				message: "Postgres not configured",
				error: "Postgres not configured",
			};
		}
		const eventKey = input.eventKey.trim();
		if (!eventKey) {
			return {
				success: false,
				message: "Event key is required",
				error: "Event key is required",
			};
		}
		const startAt = toIsoTimestamp(input.startAt);
		const endAt = toIsoTimestamp(input.endAt);
		if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
			return {
				success: false,
				message: "Valid placement window is required",
				error: "Valid placement window is required",
			};
		}

		const existing = await repository.findActivatedReportByWindow({
			eventKey,
			tier: input.tier,
			startAt,
			endAt,
		});
		const existingPath = existing ? toReportPath(existing) : null;
		if (existing && existingPath) {
			return {
				success: true,
				statsPath: existingPath,
				activationId: existing.id,
				existing: true,
				message: "Existing partner report found",
			};
		}

		const seedResult = await repository.enqueueFromStripe({
			sourceEventId: `scheduler-report-${input.placementId}-${randomUUID()}`,
			packageKey:
				input.tier === "promoted"
					? "scheduler-report-promoted"
					: "scheduler-report-spotlight",
			customerEmail: "internal-test@outofofficecollective.co.uk",
			customerName: "Internal Scheduler Report",
			eventName: input.eventName?.trim() || eventKey,
			notes: "Scheduler-created partner stats report",
			metadata: {
				createdBy: "admin-scheduler",
				placementId: input.placementId,
				placementTier: input.tier,
				reportStartAt: startAt,
				reportEndAt: endAt,
			},
			rawPayload: {
				type: "scheduler.report",
				eventKey,
				placementId: input.placementId,
			},
		});
		if (!seedResult.record) {
			return {
				success: false,
				message: "Failed to create scheduler report record",
				error: "Failed to create scheduler report record",
			};
		}

		const updated = await repository.markFulfilled({
			id: seedResult.record.id,
			eventKey,
			tier: input.tier,
			startAt,
			endAt,
			partnerStatsToken: randomUUID().replace(/-/g, ""),
			notes: `Scheduler report (${eventKey})`,
		});
		const statsPath = updated ? toReportPath(updated) : null;
		if (!updated || !statsPath) {
			return {
				success: false,
				message: "Failed to finalize scheduler report",
				error: "Failed to finalize scheduler report",
			};
		}

		return {
			success: true,
			statsPath,
			activationId: updated.id,
			existing: false,
			message: "Partner report created",
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to create partner report",
			error:
				error instanceof Error ? error.message : "Unknown partner report error",
		};
	}
}

export async function listPartnerReportsForPlacements(input: {
	placements: Array<{
		placementId: string;
		eventKey: string;
		tier: PartnerPlacementTier;
		startAt: string;
		endAt: string;
	}>;
}): Promise<
	| {
			success: true;
			reports: Record<
				string,
				{
					activationId: string;
					statsPath: string;
				}
			>;
	  }
	| { success: false; error: string }
> {
	try {
		await assertAdmin();
		const repository = getPartnerActivationRepository();
		if (!repository) {
			return { success: false, error: "Postgres not configured" };
		}

		const normalizedPlacements = input.placements
			.map((placement) => {
				const startAt = toIsoTimestamp(placement.startAt);
				const endAt = toIsoTimestamp(placement.endAt);
				if (!startAt || !endAt) return null;
				return {
					...placement,
					eventKey: placement.eventKey.trim(),
					startAt,
					endAt,
				};
			})
			.filter((placement) => placement != null);

		const records = await repository.listActivatedReportsForEventKeys(
			normalizedPlacements.map((placement) => placement.eventKey),
		);
		const recordByWindow = new Map<string, PartnerActivationRecord>();
		for (const record of records) {
			if (
				!record.fulfilledEventKey ||
				!record.fulfilledTier ||
				!record.fulfilledStartAt ||
				!record.fulfilledEndAt
			) {
				continue;
			}
			const key = toPlacementReportKey({
				eventKey: record.fulfilledEventKey,
				tier: record.fulfilledTier,
				startAt: record.fulfilledStartAt,
				endAt: record.fulfilledEndAt,
			});
			if (!recordByWindow.has(key)) {
				recordByWindow.set(key, record);
			}
		}

		const reports: Record<string, { activationId: string; statsPath: string }> =
			{};
		for (const placement of normalizedPlacements) {
			const record = recordByWindow.get(
				toPlacementReportKey({
					eventKey: placement.eventKey,
					tier: placement.tier,
					startAt: placement.startAt,
					endAt: placement.endAt,
				}),
			);
			const statsPath = record ? toReportPath(record) : null;
			if (record && statsPath) {
				reports[placement.placementId] = {
					activationId: record.id,
					statsPath,
				};
			}
		}

		return { success: true, reports };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown partner report lookup error",
		};
	}
}

export async function previewPartnerStatsReport(input: {
	eventKey: string;
	requestedStartAt?: string;
	durationHours?: number;
}): Promise<
	| {
			success: true;
			range: {
				startAt: string;
				endAt: string;
			};
			metrics: {
				clickCount: number;
				outboundClickCount: number;
				calendarSyncCount: number;
				uniqueSessionCount: number;
				outboundSessionRate: number;
				calendarSessionRate: number;
			};
	  }
	| { success: false; message: string; error: string }
> {
	try {
		await assertAdmin();
		const trimmedEventKey = input.eventKey.trim();
		if (!trimmedEventKey) {
			return {
				success: false,
				message: "Event key is required",
				error: "Event key is required",
			};
		}
		const repository = getEventEngagementRepository();
		if (!repository) {
			return {
				success: false,
				message: "Postgres not configured",
				error: "Postgres not configured",
			};
		}
		const reportWindow = buildReportWindow({
			requestedStartAt: input.requestedStartAt,
			durationHours: input.durationHours,
		});
		const summary = await repository.summarizeEventWindow({
			eventKey: trimmedEventKey,
			startAt: reportWindow.startAt,
			endAt: reportWindow.endAt,
		});

		return {
			success: true,
			range: {
				startAt: reportWindow.startAt,
				endAt: reportWindow.endAt,
			},
			metrics: {
				clickCount: summary.clickCount,
				outboundClickCount: summary.outboundClickCount,
				calendarSyncCount: summary.calendarSyncCount,
				uniqueSessionCount: summary.uniqueSessionCount,
				outboundSessionRate: toPercent(
					summary.uniqueOutboundSessionCount,
					summary.uniqueViewSessionCount,
				),
				calendarSessionRate: toPercent(
					summary.uniqueCalendarSessionCount,
					summary.uniqueViewSessionCount,
				),
			},
		};
	} catch (error) {
		return {
			success: false,
			message: "Failed to preview partner stats",
			error:
				error instanceof Error
					? error.message
					: "Unknown partner stats preview error",
		};
	}
}
