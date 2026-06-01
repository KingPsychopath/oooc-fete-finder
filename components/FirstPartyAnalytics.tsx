"use client";

import { trackPageView } from "@/features/events/engagement/client-tracking";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const EXCLUDED_PATH_PREFIXES = ["/admin"] as const;
const LOCAL_ANALYTICS_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"0.0.0.0",
]);

const shouldSuppressPageViewForHost = (hostname: string): boolean => {
	const normalized = hostname.trim().toLowerCase();
	return LOCAL_ANALYTICS_HOSTS.has(normalized) || normalized.endsWith(".local");
};

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
		if (shouldSuppressPageViewForHost(window.location.hostname)) {
			previousPathname.current = pathname;
			return;
		}
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
		const searchParams = new URLSearchParams(window.location.search);
		previousPathname.current = pathname;
		trackPageView({
			path: pathname,
			hostname: window.location.hostname,
			referrer,
			utmSource: searchParams.get("utm_source") ?? undefined,
			utmMedium: searchParams.get("utm_medium") ?? undefined,
			utmCampaign: searchParams.get("utm_campaign") ?? undefined,
			utmContent: searchParams.get("utm_content") ?? undefined,
			utmTerm: searchParams.get("utm_term") ?? undefined,
		});
	}, [pathname]);

	return null;
}
