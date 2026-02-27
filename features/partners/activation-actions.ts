"use server";

import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { getLiveEvents } from "@/features/data-management/runtime-service";
import { scheduleFeaturedEvent } from "@/features/events/featured/actions";
import { schedulePromotedEvent } from "@/features/events/promoted/actions";
import {
	type PartnerActivationStatus,
	getPartnerActivationRepository,
} from "@/lib/platform/postgres/partner-activation-repository";

const assertAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) {
		throw new Error("Unauthorized access");
	}
};

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
		const updated = await repository.updateStatus({
			id: input.activationId,
			status: "activated",
			notes: `Activated as ${input.tier} (${input.eventKey})`,
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
			message: `Activated ${input.tier} for ${input.eventKey}`,
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
