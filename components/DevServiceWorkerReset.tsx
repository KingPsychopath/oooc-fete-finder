"use client";

import { useEffect } from "react";

export function DevServiceWorkerReset() {
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!("serviceWorker" in navigator)) return;

		const isLocalHost =
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1" ||
			window.location.hostname === "::1";
		const isDevelopment = process.env.NODE_ENV === "development";

		if (!isDevelopment && !isLocalHost) return;

		void (async () => {
				try {
					const registrations = await navigator.serviceWorker.getRegistrations();
					await Promise.all(registrations.map((registration) => registration.unregister()));
				} catch {
					// Ignore cleanup failures during local cache reset.
				}

			if (!("caches" in window)) return;

				try {
					const cacheKeys = await caches.keys();
					await Promise.all(cacheKeys.map((key) => caches.delete(key)));
				} catch {
					// Ignore cache cleanup failures during local cache reset.
				}
		})();
	}, []);

	return null;
}
