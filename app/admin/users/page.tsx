import { getAdminUsersDashboard } from "@/features/users/admin-actions";
import {
	ADMIN_USERS_ACTIVITY_FILTERS,
	ADMIN_USERS_AUDIENCE_SIGNAL_FILTERS,
	ADMIN_USERS_SORT_KEYS,
	MANAGED_USER_STATUSES,
} from "@/features/users/types";
import type {
	AdminUsersSortDirection,
	ManagedUserStatus,
} from "@/features/users/types";
import { unstable_noStore as noStore } from "next/cache";
import { UsersDashboardClient } from "./UsersDashboardClient";

export const dynamic = "force-dynamic";

const readParam = (
	params: Record<string, string | string[] | undefined>,
	key: string,
): string | undefined => {
	const value = params[key];
	return Array.isArray(value) ? value[0] : value;
};

const readOption = <T extends string>(
	params: Record<string, string | string[] | undefined>,
	key: string,
	options: readonly T[],
): T | undefined => {
	const value = readParam(params, key);
	return options.includes(value as T) ? (value as T) : undefined;
};

export default async function AdminUsersPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	noStore();
	const params = await searchParams;

	const page = Number(readParam(params, "page"));
	const pageSize = Number(readParam(params, "pageSize"));
	const initialDashboard = await getAdminUsersDashboard({
		query: readParam(params, "q"),
		status: readOption(params, "status", ["all", ...MANAGED_USER_STATUSES]) as
			| ManagedUserStatus
			| "all"
			| undefined,
		activity: readOption(params, "activity", ADMIN_USERS_ACTIVITY_FILTERS),
		audienceSignal: readOption(
			params,
			"audienceSignal",
			ADMIN_USERS_AUDIENCE_SIGNAL_FILTERS,
		),
		sortKey: readOption(params, "sort", ADMIN_USERS_SORT_KEYS),
		sortDirection: readOption(params, "dir", ["asc", "desc"]) as
			| AdminUsersSortDirection
			| undefined,
		page: Number.isFinite(page) ? page : undefined,
		pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
	});
	return <UsersDashboardClient initialDashboard={initialDashboard} />;
}
