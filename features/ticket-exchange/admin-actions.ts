"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
import { getCurrentAdminActivityActor } from "@/features/admin/activity/record";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTicketExchangeRepository } from "./repository";
import type {
	TicketExchangeAdminDashboard,
	TicketExchangeListingStatus,
} from "./types";
import { normalizeTicketExchangeText } from "./utils";

const adminListingStatusSchema = z.enum([
	"active",
	"paused",
	"resolved",
	"removed",
]);

const assertTicketExchangeAdmin = async () => {
	const authorized = await validateAdminAccessFromServerContext();
	if (!authorized) throw new Error("Unauthorized access");
	const repository = getTicketExchangeRepository();
	if (!repository) throw new Error("Ticket Exchange storage is not configured.");
	return repository;
};

const revalidateAdminAndTickets = () => {
	revalidatePath("/admin/content");
	revalidatePath("/tickets");
};

export async function getTicketExchangeAdminDashboard(): Promise<{
	success: boolean;
	dashboard?: TicketExchangeAdminDashboard;
	error?: string;
}> {
	try {
		const repository = await assertTicketExchangeAdmin();
		return {
			success: true,
			dashboard: await repository.getAdminDashboard(),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to load Ticket Exchange moderation.",
		};
	}
}

export async function updateTicketExchangeListingStatusAsAdmin(input: {
	listingId: string;
	status: Extract<
		TicketExchangeListingStatus,
		"active" | "paused" | "resolved" | "removed"
	>;
}): Promise<{
	success: boolean;
	dashboard?: TicketExchangeAdminDashboard;
	error?: string;
}> {
	try {
		const repository = await assertTicketExchangeAdmin();
		const listingId = normalizeTicketExchangeText(input.listingId, 100);
		const status = adminListingStatusSchema.parse(input.status);
		await repository.updateListingStatusAsAdmin({ listingId, status });
		await recordAdminActivity({
			action: "ticket_exchange.listing_status_updated",
			category: "content",
			targetType: "ticket_exchange_listing",
			targetId: listingId,
			summary: `Ticket Exchange listing marked ${status}`,
			metadata: { status },
			severity: status === "removed" ? "destructive" : "info",
			href: "/admin/content#ticket-exchange-moderation",
		});
		revalidateAdminAndTickets();
		return {
			success: true,
			dashboard: await repository.getAdminDashboard(),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to update listing.",
		};
	}
}

export async function reviewTicketExchangeReportAsAdmin(input: {
	reportId: string;
	reviewNote?: string;
}): Promise<{
	success: boolean;
	dashboard?: TicketExchangeAdminDashboard;
	error?: string;
}> {
	try {
		const repository = await assertTicketExchangeAdmin();
		const reportId = normalizeTicketExchangeText(input.reportId, 100);
		const actor = await getCurrentAdminActivityActor();
		await repository.reviewReportAsAdmin({
			reportId,
			reviewedBy: actor.actorLabel,
			reviewNote: normalizeTicketExchangeText(input.reviewNote ?? "", 240),
		});
		await recordAdminActivity({
			action: "ticket_exchange.report_reviewed",
			category: "content",
			targetType: "ticket_exchange_report",
			targetId: reportId,
			summary: "Ticket Exchange report reviewed",
			metadata: { reviewNote: input.reviewNote ?? "" },
			href: "/admin/content#ticket-exchange-moderation",
		});
		revalidateAdminAndTickets();
		return {
			success: true,
			dashboard: await repository.getAdminDashboard(),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to review report.",
		};
	}
}
