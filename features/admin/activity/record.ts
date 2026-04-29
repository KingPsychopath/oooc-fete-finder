import "server-only";

import type { AdminActivityRecordInput } from "@/features/admin/activity/types";
import {
	type AdminTokenPayload,
	getCurrentAdminSession,
} from "@/features/auth/admin-auth-token";
import { log } from "@/lib/platform/logger";
import { getAdminActivityRepository } from "@/lib/platform/postgres/admin-activity-repository";

const shortJti = (jti: string): string =>
	jti.length <= 14 ? jti : `${jti.slice(0, 8)}...${jti.slice(-4)}`;

const safeMetadata = (
	metadata: Record<string, unknown> | undefined,
): Record<string, unknown> => {
	if (!metadata) return {};
	return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
};

const getCurrentAdminSessionOrNull =
	async (): Promise<AdminTokenPayload | null> => {
		try {
			return await getCurrentAdminSession();
		} catch {
			return null;
		}
	};

export const recordAdminActivity = async (
	input: AdminActivityRecordInput,
): Promise<void> => {
	if (process.env.NODE_ENV === "test") return;

	const repository = getAdminActivityRepository();
	if (!repository) return;

	try {
		const currentSession =
			input.actorType || input.actorSessionJti
				? null
				: await getCurrentAdminSessionOrNull();
		const actorSessionJti =
			input.actorSessionJti ?? currentSession?.jti ?? null;
		const actorType =
			input.actorType ?? (actorSessionJti ? "admin_session" : "admin_key");
		const actorLabel =
			input.actorLabel ??
			(actorSessionJti
				? `Admin session ${shortJti(actorSessionJti)}`
				: actorType === "cron"
					? "Cron"
					: actorType === "system"
						? "System"
						: "Admin key");

		await repository.create({
			actorType,
			actorLabel,
			actorSessionJti,
			action: input.action,
			category: input.category,
			targetType: input.targetType,
			targetId: input.targetId ?? null,
			targetLabel: input.targetLabel ?? null,
			summary: input.summary,
			metadata: safeMetadata(input.metadata),
			severity: input.severity ?? "info",
			href: input.href ?? null,
		});
	} catch (error) {
		log.warn("admin-activity", "Failed to record admin activity", {
			action: input.action,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};
