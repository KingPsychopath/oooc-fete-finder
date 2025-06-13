// Import shared user types
export type { UserRecord as EmailRecord } from "@/types/user";

// Import centralized cache types instead of duplicating
export type { CacheStatus } from "@/lib/cache-management/cache-types";

export type DynamicSheetConfig = {
	hasDynamicOverride: boolean;
	sheetId: string | null;
	range: string | null;
	envSheetId: string | null;
	envRange: string | null;
};
