"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const STATIC_RESOURCE_PATH_PREFIXES = ["/fonts/", "/favicon"] as const;
const NEXT_STATIC_RESOURCE_PATH_PREFIX = "/_next/static/";

const normalizeBasePath = (value: string): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

const withoutBasePath = (pathname: string, basePath: string) => {
	if (!basePath || !pathname.startsWith(basePath)) return pathname;
	return pathname.slice(basePath.length) || "/";
};

const isRuntimeCacheSeedUrl = (value: string, basePath: string) => {
	try {
		const url = new URL(value, window.location.origin);
		if (url.origin !== window.location.origin) return false;
		const pathname = withoutBasePath(url.pathname, basePath);
		return (
			pathname.startsWith(NEXT_STATIC_RESOURCE_PATH_PREFIX) ||
			STATIC_RESOURCE_PATH_PREFIXES.some((prefix) =>
				pathname.startsWith(prefix),
			)
		);
	} catch {
		return false;
	}
};

const collectRuntimeCacheSeedUrls = (basePath: string) => {
	const urls = new Set<string>();

	for (const element of document.querySelectorAll<
		HTMLScriptElement | HTMLLinkElement
	>("script[src],link[href]")) {
		const url =
			element instanceof HTMLScriptElement ? element.src : element.href;
		if (isRuntimeCacheSeedUrl(url, basePath)) {
			urls.add(new URL(url, window.location.origin).href);
		}
	}

	for (const entry of performance.getEntriesByType("resource")) {
		if (isRuntimeCacheSeedUrl(entry.name, basePath)) {
			urls.add(new URL(entry.name, window.location.origin).href);
		}
	}

	return [...urls];
};

const sendRuntimeCacheUrlsToServiceWorker = (basePath: string) => {
	const controller = navigator.serviceWorker.controller;
	if (!controller) return;

	const urls = collectRuntimeCacheSeedUrls(basePath);
	if (urls.length === 0) return;
	controller.postMessage({ type: "CACHE_STATIC_URLS", urls });
};

const sendNavigationSnapshotToServiceWorker = () => {
	const controller = navigator.serviceWorker.controller;
	if (!controller) return;
	controller.postMessage({
		type: "CACHE_CURRENT_NAVIGATION",
		url: window.location.href,
	});
};

export function ServiceWorkerRegistration() {
	const pathname = usePathname();

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		if (process.env.NODE_ENV !== "production") {
			void navigator.serviceWorker
				.getRegistrations()
				.then((registrations) =>
					Promise.all(
						registrations.map((registration) => registration.unregister()),
					),
				)
				.catch(() => undefined);
			return;
		}

		const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
		const serviceWorkerPath = `${basePath}/sw.js`;

		let observer: PerformanceObserver | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;
		const originalPushState = window.history.pushState;
		const originalReplaceState = window.history.replaceState;

		const scheduleStaticCacheSeed = () => {
			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				sendNavigationSnapshotToServiceWorker();
				sendRuntimeCacheUrlsToServiceWorker(basePath);
			}, 250);
		};

		const handleHistoryChange = () => {
			scheduleStaticCacheSeed();
		};

		window.history.pushState = function pushStateWithServiceWorkerCache(
			data: unknown,
			unused: string,
			url?: string | URL | null,
		) {
			const result = originalPushState.call(window.history, data, unused, url);
			handleHistoryChange();
			return result;
		};
		window.history.replaceState = function replaceStateWithServiceWorkerCache(
			data: unknown,
			unused: string,
			url?: string | URL | null,
		) {
			const result = originalReplaceState.call(
				window.history,
				data,
				unused,
				url,
			);
			handleHistoryChange();
			return result;
		};
		window.addEventListener("popstate", handleHistoryChange);
		window.addEventListener("hashchange", handleHistoryChange);

		void navigator.serviceWorker
			.register(serviceWorkerPath, { updateViaCache: "none" })
			.then(async () => {
				await navigator.serviceWorker.ready;
				scheduleStaticCacheSeed();
				navigator.serviceWorker.addEventListener(
					"controllerchange",
					scheduleStaticCacheSeed,
				);

				if ("PerformanceObserver" in window) {
					observer = new PerformanceObserver(scheduleStaticCacheSeed);
					observer.observe({ entryTypes: ["resource"] });
				}
			})
			.catch(() => {
				// Offline support is progressive; the app should keep working without SW.
			});

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
			window.history.pushState = originalPushState;
			window.history.replaceState = originalReplaceState;
			window.removeEventListener("popstate", handleHistoryChange);
			window.removeEventListener("hashchange", handleHistoryChange);
			navigator.serviceWorker.removeEventListener(
				"controllerchange",
				scheduleStaticCacheSeed,
			);
			observer?.disconnect();
		};
	}, []);

	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		if (process.env.NODE_ENV !== "production") return;
		if (!pathname) return;

		const timeoutId = window.setTimeout(() => {
			sendNavigationSnapshotToServiceWorker();
			const basePath = normalizeBasePath(
				process.env.NEXT_PUBLIC_BASE_PATH || "",
			);
			sendRuntimeCacheUrlsToServiceWorker(basePath);
		}, 500);

		return () => window.clearTimeout(timeoutId);
	}, [pathname]);

	return null;
}
