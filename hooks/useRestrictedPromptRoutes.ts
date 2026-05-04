"use client";

import { usePathname } from "next/navigation";

const RESTRICTED_PREFIXES: string[] = [
	"/admin",
	"/social",
	"/partner-stats",
	"/partner-success",
];

const RESTRICTED_EXACT_PATHS: string[] = ["/submit-event"];

export function useIsRestrictedPromptRoute(): boolean {
	const pathname = usePathname();

	if (!pathname) return false;

	if (RESTRICTED_EXACT_PATHS.includes(pathname)) {
		return true;
	}

	return RESTRICTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
