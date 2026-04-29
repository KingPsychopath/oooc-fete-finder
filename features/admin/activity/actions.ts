"use server";

import type {
	AdminActivityCategory,
	AdminActivityEvent,
} from "@/features/admin/activity/types";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { getAdminActivityRepository } from "@/lib/platform/postgres/admin-activity-repository";

export async function getAdminActivityOverview(
	keyOrToken?: string,
	limit = 80,
): Promise<{
	success: boolean;
	supported?: boolean;
	events?: AdminActivityEvent[];
	categoryCounts?: Record<AdminActivityCategory, number>;
	error?: string;
}> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}

	const repository = getAdminActivityRepository();
	if (!repository) {
		return {
			success: true,
			supported: false,
			events: [],
			categoryCounts: {
				auth: 0,
				content: 0,
				insights: 0,
				operations: 0,
				placements: 0,
				settings: 0,
			},
		};
	}

	try {
		const safeLimit = Math.max(10, Math.min(limit, 120));
		const [events, categoryCounts] = await Promise.all([
			repository.listRecent({ limit: safeLimit }),
			repository.countByCategory(),
		]);

		return {
			success: true,
			supported: true,
			events,
			categoryCounts,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to load admin activity",
		};
	}
}
