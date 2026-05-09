"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (!("serviceWorker" in navigator)) return;

		const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
		const serviceWorkerPath = `${basePath}/sw.js`;

		void navigator.serviceWorker.register(serviceWorkerPath).catch(() => {
			// Offline support is progressive; the app should keep working without SW.
		});
	}, []);

	return null;
}
