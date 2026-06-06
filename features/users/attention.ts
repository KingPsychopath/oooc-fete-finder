import type { AdminUserSummary } from "./types";

export const ADMIN_USER_ATTENTION_SUMMARY =
	"Blocked/deleted, restricted, notified, or pending report.";

export const ADMIN_USER_ATTENTION_DETAIL =
	"Includes users with blocked/deleted status, active restrictions, live notices, or pending ticket reports against their listings.";

type AttentionUser = Pick<
	AdminUserSummary,
	| "status"
	| "activeRestrictionCount"
	| "openNoticeCount"
	| "openTicketReportCount"
>;

export const getAdminUserAttentionReasons = (user: AttentionUser): string[] => {
	const reasons: string[] = [];
	if (user.status === "blocked") reasons.push("Blocked account");
	if (user.status === "deleted") reasons.push("Deleted account");
	if (user.activeRestrictionCount > 0) {
		reasons.push(
			`${user.activeRestrictionCount} active restriction${user.activeRestrictionCount === 1 ? "" : "s"}`,
		);
	}
	if (user.openNoticeCount > 0) {
		reasons.push(
			`${user.openNoticeCount} live notice${user.openNoticeCount === 1 ? "" : "s"}`,
		);
	}
	if (user.openTicketReportCount > 0) {
		reasons.push(
			`${user.openTicketReportCount} pending ticket report${user.openTicketReportCount === 1 ? "" : "s"} against their listings`,
		);
	}
	return reasons;
};

export const needsAdminUserAttention = (user: AttentionUser): boolean =>
	getAdminUserAttentionReasons(user).length > 0;
