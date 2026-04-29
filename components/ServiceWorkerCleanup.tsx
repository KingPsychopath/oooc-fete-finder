"use client";

import { useEffect } from "react";

const CLEANUP_STORAGE_KEY = "oooc:service-worker-cleanup:v1";

const hasCleanupRun = () => {
	try {
		return window.localStorage.getItem(CLEANUP_STORAGE_KEY) === "done";
	} catch {
		return false;
	}
};

const markCleanupRun = () => {
	try {
		window.localStorage.setItem(CLEANUP_STORAGE_KEY, "done");
	} catch {
		// Cache cleanup is still useful even when localStorage is unavailable.
	}
};

export function ServiceWorkerCleanup() {
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (hasCleanupRun()) return;

		void (async () => {
			try {
				if ("serviceWorker" in navigator) {
					const registrations = await navigator.serviceWorker.getRegistrations();
					await Promise.all(
						registrations.map((registration) => registration.unregister()),
					);
				}

				if ("caches" in window) {
					const cacheKeys = await caches.keys();
					await Promise.all(cacheKeys.map((key) => caches.delete(key)));
				}
			} catch {
				return;
			}

			markCleanupRun();
		})();
	}, []);

	return null;
}
