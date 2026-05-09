import { expect, type Page, test } from "@playwright/test";

const EVENT_PATH = "/event/evt_115811d709b9b6ed/krispy-jam-n-29-tascha";
const EVENT_KEY = "evt_115811d709b9b6ed";
const EVENT_TITLE = "Krispy Jam N°29 - Tascha";
const OFFLINE_DATABASE_NAME = "oooc-fete-finder";
const OFFLINE_SNAPSHOT_STORE = "event-snapshots";
const OFFLINE_DETAIL_SNAPSHOT_STORE = "event-detail-snapshots";
const OFFLINE_HOME_SNAPSHOT_KEY = "home";

const waitForServiceWorkerReady = async (page: Page) => {
	await page.evaluate(async () => {
		if (!("serviceWorker" in navigator)) {
			throw new Error("Service workers are not available");
		}
		await navigator.serviceWorker.ready;
	});
};

const waitForServiceWorkerController = async (page: Page) => {
	await page.waitForFunction(async () => {
		if (!("serviceWorker" in navigator)) return false;
		if (navigator.serviceWorker.controller) return true;
		await navigator.serviceWorker.ready;
		return Boolean(navigator.serviceWorker.controller);
	});
};

const waitForHomeEventSnapshot = async (page: Page) => {
	await page.waitForFunction(
		async ({ databaseName, storeName, snapshotKey }) => {
			const snapshot = await new Promise<unknown>((resolve, reject) => {
				const request = indexedDB.open(databaseName);

				request.onerror = () =>
					reject(request.error ?? new Error("Unable to open IndexedDB"));
				request.onsuccess = () => {
					const database = request.result;
					if (!database.objectStoreNames.contains(storeName)) {
						database.close();
						resolve(null);
						return;
					}

					const transaction = database.transaction(storeName, "readonly");
					const store = transaction.objectStore(storeName);
					const getRequest = store.get(snapshotKey);

					getRequest.onerror = () =>
						reject(
							getRequest.error ?? new Error("Unable to read event snapshot"),
						);
					getRequest.onsuccess = () => {
						database.close();
						resolve(getRequest.result);
					};
				};
			});

			if (!snapshot || typeof snapshot !== "object") return false;
			const candidate = snapshot as {
				events?: unknown[];
				metadata?: {
					eventCount?: number;
					schemaName?: string;
					schemaVersion?: number;
				};
				savedAt?: string;
			};

			return (
				Array.isArray(candidate.events) &&
				candidate.events.length > 0 &&
				candidate.metadata?.eventCount === candidate.events.length &&
				candidate.metadata.schemaName === "home-events" &&
				candidate.metadata.schemaVersion === 1 &&
				typeof candidate.savedAt === "string"
			);
		},
		{
			databaseName: OFFLINE_DATABASE_NAME,
			storeName: OFFLINE_SNAPSHOT_STORE,
			snapshotKey: OFFLINE_HOME_SNAPSHOT_KEY,
		},
	);
};

const waitForEventDetailSnapshot = async (page: Page, eventKey: string) => {
	await page.waitForFunction(
		async ({ databaseName, storeName, snapshotKey }) => {
			const snapshot = await new Promise<unknown>((resolve, reject) => {
				const request = indexedDB.open(databaseName);

				request.onerror = () =>
					reject(request.error ?? new Error("Unable to open IndexedDB"));
				request.onsuccess = () => {
					const database = request.result;
					if (!database.objectStoreNames.contains(storeName)) {
						database.close();
						resolve(null);
						return;
					}

					const transaction = database.transaction(storeName, "readonly");
					const store = transaction.objectStore(storeName);
					const getRequest = store.get(snapshotKey);

					getRequest.onerror = () =>
						reject(
							getRequest.error ??
								new Error("Unable to read event detail snapshot"),
						);
					getRequest.onsuccess = () => {
						database.close();
						resolve(getRequest.result);
					};
				};
			});

			if (!snapshot || typeof snapshot !== "object") return false;
			const candidate = snapshot as {
				event?: { eventKey?: string; name?: string };
				metadata?: {
					eventKey?: string;
					schemaName?: string;
					schemaVersion?: number;
				};
				savedAt?: string;
			};

			return (
				candidate.event?.eventKey === snapshotKey &&
				candidate.event.name === "Krispy Jam N°29 - Tascha" &&
				candidate.metadata?.eventKey === snapshotKey &&
				candidate.metadata.schemaName === "event-detail" &&
				candidate.metadata.schemaVersion === 1 &&
				typeof candidate.savedAt === "string"
			);
		},
		{
			databaseName: OFFLINE_DATABASE_NAME,
			storeName: OFFLINE_DETAIL_SNAPSHOT_STORE,
			snapshotKey: eventKey,
		},
	);
};

const getCachedPathnames = async (page: Page) =>
	page.evaluate(async () => {
		const cacheNames = await caches.keys();
		const cachedUrls = await Promise.all(
			cacheNames.map(async (cacheName) => {
				const cache = await caches.open(cacheName);
				const requests = await cache.keys();
				return requests.map((request) => new URL(request.url).pathname);
			}),
		);
		return cachedUrls.flat();
	});

const waitForNextStaticCache = async (page: Page) => {
	await page.waitForFunction(async () => {
		const cacheNames = await caches.keys();
		for (const cacheName of cacheNames) {
			const cache = await caches.open(cacheName);
			const requests = await cache.keys();
			if (
				requests.some((request) =>
					new URL(request.url).pathname.startsWith("/_next/static/"),
				)
			) {
				return true;
			}
		}
		return false;
	});
};

const failOnChunkLoadError = (page: Page) => {
	const errors: string[] = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			errors.push(message.text());
		}
	});
	page.on("pageerror", (error) => {
		errors.push(error.message);
	});

	return () => {
		expect(
			errors.filter((message) => /ChunkLoadError|Loading chunk/i.test(message)),
		).toEqual([]);
	};
};

test.describe("event share routes", () => {
	test("direct event URL renders the hydrated modal", async ({ page }) => {
		await page.goto(EVENT_PATH);

		const modal = page.getByRole("dialog", { name: EVENT_TITLE });
		await expect(modal).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Close event details" }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Browse all events" }),
		).toBeHidden();
		await expect(modal).toHaveScreenshot("direct-event-modal.png");
	});

	test("closing a direct event URL lands cleanly on the homepage", async ({
		page,
	}) => {
		await page.goto(EVENT_PATH);
		await page.getByRole("button", { name: "Close event details" }).click();

		await expect(page).toHaveURL("/");
		await expect(
			page.getByText("Discover events across the city"),
		).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator("#event-map")).toHaveScreenshot(
			"close-to-home-map.png",
		);
	});

	test("homepage card clicks open an event modal without a full page navigation flash", async ({
		page,
	}) => {
		await page.goto("/");

		await page.locator("#tour-first-event-card").click();

		await expect(page).toHaveURL(/\/event\/evt_[^/]+\/[^/]+/);
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Close event details" }),
		).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveScreenshot(
			"homepage-click-modal.png",
		);
	});

	test("homepage event modal opens promptly without a late layout jump", async ({
		page,
	}) => {
		await page.goto("/");

		await page.locator("#tour-first-event-card").click();

		const modalCard = page.locator("[data-event-modal-card]");
		await expect(modalCard).toBeVisible();

		const firstBox = await modalCard.boundingBox();
		expect(firstBox).not.toBeNull();
		await page.waitForTimeout(700);
		const settledBox = await modalCard.boundingBox();
		expect(settledBox).not.toBeNull();

		expect(Math.abs((settledBox?.x ?? 0) - (firstBox?.x ?? 0))).toBeLessThan(3);
		expect(Math.abs((settledBox?.y ?? 0) - (firstBox?.y ?? 0))).toBeLessThan(3);
		expect(
			Math.abs((settledBox?.width ?? 0) - (firstBox?.width ?? 0)),
		).toBeLessThan(3);
		expect(
			Math.abs((settledBox?.height ?? 0) - (firstBox?.height ?? 0)),
		).toBeLessThan(8);
	});

	test("homepage map stays deferred until map intent", async ({ page }) => {
		await page.goto("/");

		await expect(
			page.getByRole("button", { name: /expand paris event map/i }),
		).toBeVisible();
		await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);

		await page.getByRole("button", { name: /expand paris event map/i }).click();

		await expect(page.getByText("MapLibre", { exact: true })).toBeVisible();
	});

	test("homepage reloads offline from saved events with search and map fallback", async ({
		context,
		page,
	}) => {
		await page.goto("/");
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForServiceWorkerReady(page);
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForHomeEventSnapshot(page);

		await context.setOffline(true);
		await page.evaluate(() => {
			window.localStorage.setItem(
				"oooc_offline_auth_grace_v1",
				JSON.stringify({
					email: "offline-e2e@example.com",
					expiresAt: Date.now() + 60 * 60 * 1000,
				}),
			);
		});
		await page.reload({ waitUntil: "domcontentloaded" });

		await expect(page.getByText(/^Saved events:/)).toBeVisible();
		await expect(page.locator("#tour-first-event-card")).toBeVisible();

		const searchInput = page.getByRole("textbox", {
			name: "Search events, locations, genres, phases...",
		});
		await searchInput.fill("Krispy");
		await expect(
			page
				.locator("#tour-all-events")
				.getByRole("heading", { name: "Krispy Jam N°29 - Tascha" }),
		).toBeVisible();
		await expect(page.getByText(/\b1 event found\b/)).toBeVisible();

		await expect(
			page.getByText(
				"Map style, sprite, glyph, and tile assets are online-only. Saved event browsing, search, and filters are still available below.",
			),
		).toBeVisible();
	});

	test("event modal reopens offline from saved event detail", async ({
		context,
		page,
	}) => {
		await page.goto("/");
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForServiceWorkerReady(page);
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForHomeEventSnapshot(page);

		await page
			.locator("#tour-all-events")
			.getByRole("heading", { name: EVENT_TITLE })
			.click();
		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
		await waitForEventDetailSnapshot(page, EVENT_KEY);

		await context.setOffline(true);
		await page.reload({ waitUntil: "domcontentloaded" });

		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
		await expect(
			page.getByText(
				/Some live details may be unavailable until you are back online/,
			),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Close event details" }),
		).toBeVisible();
	});

	test("offline acceptance pass covers PWA cache boundaries and reconnect", async ({
		context,
		page,
	}) => {
		const assertNoChunkLoadError = failOnChunkLoadError(page);
		await page.goto("/");
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForServiceWorkerReady(page);
		await waitForServiceWorkerController(page);
		await waitForNextStaticCache(page);
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.locator("#tour-first-event-card")).toBeVisible();

		const serviceWorkerState = await page.evaluate(() => ({
			hasController: Boolean(navigator.serviceWorker.controller),
			manifestHref:
				document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ??
				null,
		}));
		expect(serviceWorkerState.hasController).toBe(true);
		expect(serviceWorkerState.manifestHref).toContain("/manifest.webmanifest");
		await waitForNextStaticCache(page);

		await waitForHomeEventSnapshot(page);
		await page
			.locator("#tour-all-events")
			.getByRole("heading", { name: EVENT_TITLE })
			.click();
		await waitForEventDetailSnapshot(page, EVENT_KEY);
		await page.getByRole("button", { name: "Close event details" }).click();

		await page.evaluate(async () => {
			await Promise.allSettled([
				fetch("/api/auth/session"),
				fetch("/api/user/preference"),
				fetch("/api/admin/health"),
			]);
		});
		const cachedPathnames = await getCachedPathnames(page);
		expect(cachedPathnames).not.toContain("/api/auth/session");
		expect(cachedPathnames).not.toContain("/api/user/preference");
		expect(cachedPathnames).not.toContain("/api/admin/health");

		await context.setOffline(true);
		await page.evaluate(() => {
			window.localStorage.setItem(
				"oooc_offline_auth_grace_v1",
				JSON.stringify({
					email: "offline-e2e@example.com",
					expiresAt: Date.now() + 60 * 60 * 1000,
				}),
			);
		});
		await page.reload({ waitUntil: "domcontentloaded" });

		await expect(page.getByText(/^Saved events:/)).toBeVisible();
		await page.getByRole("button", { name: /show picks/i }).click();
		await expect(
			page.getByRole("button", { name: /showing picks/i }),
		).toBeVisible();
		const searchInput = page.getByRole("textbox", {
			name: "Search events, locations, genres, phases...",
		});
		await searchInput.fill("Krispy");
		await expect(
			page
				.locator("#tour-all-events")
				.getByRole("heading", { name: EVENT_TITLE }),
		).toBeVisible();
		await expect(page.getByText(/\b1 event found\b/)).toBeVisible();
		await page
			.locator("#tour-all-events")
			.getByRole("heading", { name: EVENT_TITLE })
			.click();
		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
		await expect(
			page.getByText(
				"Map style, sprite, glyph, and tile assets are online-only. Saved event browsing, search, and filters are still available below.",
			),
		).toBeVisible();

		await context.setOffline(false);
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
		await expect(page.getByText(/^Saved events:/)).toHaveCount(0);
		await page.getByRole("button", { name: "Close event details" }).click();
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		assertNoChunkLoadError();
	});
});

test.describe("event share routes on mobile", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("direct event URL is framed correctly on mobile", async ({ page }) => {
		await page.goto(EVENT_PATH);

		const modal = page.getByRole("dialog", { name: EVENT_TITLE });
		await expect(modal).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Close event details" }),
		).toBeVisible();
		await expect(modal).toHaveScreenshot("mobile-direct-event-modal.png");
	});
});

test.describe("event share routes without JavaScript", () => {
	test.use({ javaScriptEnabled: false });

	test("direct event URL keeps a server-rendered modal preview", async ({
		page,
	}) => {
		await page.goto(EVENT_PATH);

		const preview = page.locator("section").filter({ hasText: EVENT_TITLE });
		await expect(preview).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Close event details" }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Browse all events" }),
		).toBeVisible();
		await expect(preview).toHaveScreenshot("no-js-event-preview.png");
	});
});
