"use client";

import { trackPageView } from "@/features/events/engagement/client-tracking";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const EXCLUDED_PATH_PREFIXES = ["/admin"] as const;

const normalizeReferrer = (referrer: string): string => {
	if (!referrer) return "direct";
	try {
		const url = new URL(referrer);
		if (url.hostname === window.location.hostname) return "internal";
		return url.hostname.replace(/^www\./, "");
	} catch {
		return "unknown";
	}
};

export function FirstPartyAnalytics() {
	const pathname = usePathname() || "/";
	const previousPathname = useRef<string | null>(null);

	useEffect(() => {
		if (
			EXCLUDED_PATH_PREFIXES.some(
				(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
			)
		) {
			previousPathname.current = pathname;
			return;
		}
		const referrer =
			previousPathname.current === null
				? normalizeReferrer(document.referrer)
				: "internal";
		previousPathname.current = pathname;
		trackPageView({
			path: pathname,
			hostname: window.location.hostname,
			referrer,
		});
	}, [pathname]);

	return null;
}
