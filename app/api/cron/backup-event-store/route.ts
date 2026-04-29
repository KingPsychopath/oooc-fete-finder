import { EventStoreBackupService } from "@/features/data-management/event-store-backup-service";
import { recordAdminActivity } from "@/features/admin/activity/record";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron endpoint: create periodic operational backups.
 * Secure with CRON_SECRET (Vercel sends Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: NextRequest) {
	const secret = process.env.CRON_SECRET?.trim();
	const auth = request.headers.get("authorization");
	const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";

	if (!secret || token !== secret) {
		return NextResponse.json(
			{ error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const result = await EventStoreBackupService.createBackup({
			createdBy: "cron",
			trigger: "cron",
		});

		if (!result.success) {
			if (result.noData) {
				return NextResponse.json(
					{ ok: true, skipped: true, message: result.message },
					{ headers: NO_STORE_HEADERS },
				);
			}

			return NextResponse.json(
				{ ok: false, message: result.message, error: result.error },
				{ status: 500, headers: NO_STORE_HEADERS },
			);
		}
		await recordAdminActivity({
			actorType: "cron",
			actorLabel: "Daily backup cron",
			action: "backup.created",
			category: "operations",
			targetType: "event_store_backup",
			targetId: result.backup?.id ?? null,
			targetLabel: "Daily snapshot",
			summary: "Daily operational snapshot created",
			metadata: {
				trigger: "cron",
				rowCount: result.backup?.rowCount ?? 0,
				featuredEntryCount: result.backup?.featuredEntryCount ?? 0,
				userCollectionCount: result.backup?.userCollectionCount ?? null,
				prunedCount: result.prunedCount ?? 0,
			},
			href: "/admin/operations#data-store-controls",
		});

		return NextResponse.json(
			{
				ok: true,
				message: result.message,
				backup: result.backup,
				prunedCount: result.prunedCount ?? 0,
			},
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{ ok: false, error: message },
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
