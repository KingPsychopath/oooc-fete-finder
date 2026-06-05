import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const serviceWorkerSource = readFileSync(join(root, "public/sw.js"), "utf8");
const layoutSource = readFileSync(join(root, "app/layout.tsx"), "utf8");

describe("service worker hardening", () => {
	it("does not use the old app-shell cache pattern", () => {
		expect(serviceWorkerSource).not.toContain("app-shell");
		expect(serviceWorkerSource).not.toContain("APP_SHELL_CACHE");
		expect(serviceWorkerSource).not.toContain("CACHE_NAVIGATION_URL");
	});

	it("serves cached navigations only through coherent page metadata", () => {
		expect(serviceWorkerSource).toContain("PAGE_CACHE");
		expect(serviceWorkerSource).toContain("PAGE_METADATA_CACHE");
		expect(serviceWorkerSource).toContain("CACHE_PREFIX");
		expect(serviceWorkerSource).toContain("cacheNavigationSnapshot");
		expect(serviceWorkerSource).toContain("getCoherentCachedNavigation");
		expect(serviceWorkerSource).toContain(
			"hasCachedStaticAssets(metadata.assetUrls)",
		);
		expect(serviceWorkerSource).toContain("metadata.cacheVersion");
		expect(serviceWorkerSource).toContain("OFFLINE_FALLBACK_PATH");
	});

	it("seeds offline page snapshots after client-side URL changes", () => {
		expect(layoutSource).toContain("ServiceWorkerRegistration");
		const registrationSource = readFileSync(
			join(root, "components/ServiceWorkerRegistration.tsx"),
			"utf8",
		);
		expect(registrationSource).toContain("pushStateWithServiceWorkerCache");
		expect(registrationSource).toContain("replaceStateWithServiceWorkerCache");
		expect(registrationSource).toContain("CACHE_CURRENT_NAVIGATION");
	});

	it("keeps online navigations network-first", () => {
		expect(serviceWorkerSource).toMatch(
			/request\.mode === "navigate"[\s\S]*event\.respondWith\(handleNavigationRequest\(event\)\)/,
		);
		expect(serviceWorkerSource).toMatch(
			/const response = await fetch\(request\)[\s\S]*event\.waitUntil\(cacheNavigationSnapshot\(request, response\.clone\(\)\)\)/,
		);
		expect(serviceWorkerSource).toMatch(
			/catch \{[\s\S]*getCoherentCachedNavigation\(request\)/,
		);
	});

	it("has a static asset recovery path before React hydration", () => {
		expect(serviceWorkerSource).toContain("MISSING_STATIC_ASSET");
		expect(layoutSource).toContain("assetRecoveryScript");
		expect(layoutSource).toContain("MISSING_STATIC_ASSET");
		expect(layoutSource).toContain("ChunkLoadError");
		expect(layoutSource).toContain("static-asset-recovery");
	});
});
