"use client";

import { useAuth } from "@/features/auth/auth-context";
import EventModal from "@/features/events/components/EventModal";
import type { Event } from "@/features/events/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface EventShareClientProps {
	event: Event;
}

const REQUEST_UPDATE_PARAM = "requestUpdate";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const buildEventPath = (event: Event, params = new URLSearchParams()): string => {
	const normalizedBasePath = normalizeBasePath(basePath);
	const encodedEventKey = encodeURIComponent(event.eventKey);
	const encodedSlug = event.slug ? `/${encodeURIComponent(event.slug)}` : "";
	const query = params.toString();
	const path = `${normalizedBasePath}/event/${encodedEventKey}${encodedSlug}`;
	return query ? `${path}?${query}` : path;
};

export function EventShareClient({ event }: EventShareClientProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { isAuthenticated } = useAuth();
	const [hasHydrated, setHasHydrated] = useState(false);
	const [isRequestUpdateOpen, setIsRequestUpdateOpen] = useState(
		() => searchParams.get(REQUEST_UPDATE_PARAM) === "1",
	);
	const homeHref = normalizeBasePath(basePath) || "/";

	useEffect(() => {
		setHasHydrated(true);
		const previewElements = document.querySelectorAll<HTMLElement>(
			"[data-event-share-preview]",
		);
		for (const element of previewElements) {
			element.hidden = true;
		}
		return () => {
			for (const element of previewElements) {
				element.hidden = false;
			}
		};
	}, []);

	useEffect(() => {
		let idleId: number | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const prefetchHome = () => {
			router.prefetch(homeHref);
		};

		if (typeof window !== "undefined" && "requestIdleCallback" in window) {
			idleId = window.requestIdleCallback(prefetchHome, { timeout: 1600 });
		} else {
			timeoutId = setTimeout(prefetchHome, 900);
		}

		return () => {
			if (
				idleId !== null &&
				typeof window !== "undefined" &&
				"cancelIdleCallback" in window
			) {
				window.cancelIdleCallback(idleId);
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [homeHref, router]);

	const handleClose = () => {
		router.push(homeHref);
	};

	const handleRequestUpdateOpenChange = (open: boolean) => {
		setIsRequestUpdateOpen(open);
		const nextParams = new URLSearchParams(searchParams.toString());
		if (open) {
			nextParams.set(REQUEST_UPDATE_PARAM, "1");
		} else {
			nextParams.delete(REQUEST_UPDATE_PARAM);
		}
		router.replace(buildEventPath(event, nextParams), { scroll: false });
	};

	if (!hasHydrated) {
		return null;
	}

	return (
		<EventModal
			event={event}
			isOpen
			onClose={handleClose}
			isAuthenticated={isAuthenticated}
			isRequestUpdateOpen={isRequestUpdateOpen}
			onRequestUpdateOpenChange={handleRequestUpdateOpenChange}
		/>
	);
}
