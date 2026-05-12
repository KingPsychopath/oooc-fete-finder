import { readFileSync } from "node:fs";
import { type BrowserContext, type Page, expect, test } from "@playwright/test";
import jwt from "jsonwebtoken";

const EVENT_PATH = "/event/evt_115811d709b9b6ed/krispy-jam-n-29-tascha";
const EVENT_KEY = "evt_115811d709b9b6ed";
const EVENT_TITLE = "Krispy Jam N°29 - Tascha";
const OFFLINE_DATABASE_NAME = "oooc-fete-finder";
const OFFLINE_SNAPSHOT_STORE = "event-snapshots";
const OFFLINE_DETAIL_SNAPSHOT_STORE = "event-detail-snapshots";
const OFFLINE_HOME_SNAPSHOT_KEY = "home";
const USER_AUTH_COOKIE_NAME = "oooc_user_session";
const USER_AUTH_COOKIE_AUDIENCE = "oooc-fete-finder:user";
const USER_AUTH_COOKIE_ISSUER = "oooc-fete-finder";
const E2E_USER_ID = "019b0000-0000-7000-8000-000000000001";

const readLocalEnvValue = (key: string) => {
	try {
		const envFile = readFileSync(".env", "utf8");
		const line = envFile
			.split(/\r?\n/)
			.find((candidate) => candidate.startsWith(`${key}=`));
		return line?.slice(key.length + 1).trim();
	} catch {
		return undefined;
	}
};

const signE2eUserSessionToken = (email: string) => {
	const authSecret =
		process.env.AUTH_SECRET?.trim() || readLocalEnvValue("AUTH_SECRET");
	if (!authSecret) throw new Error("AUTH_SECRET is required for auth e2e");
	return jwt.sign(
		{
			email: email.toLowerCase().trim(),
			userId: E2E_USER_ID,
			v: 1,
		},
		authSecret,
		{
			algorithm: "HS256",
			audience: USER_AUTH_COOKIE_AUDIENCE,
			expiresIn: 60 * 60 * 24 * 30,
			issuer: USER_AUTH_COOKIE_ISSUER,
		},
	);
};

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

const verifyUserSession = async (page: Page) => {
	await page.context().addCookies([
		{
			name: USER_AUTH_COOKIE_NAME,
			value: signE2eUserSessionToken("offline-e2e@example.com"),
			url: "http://localhost:3000",
			httpOnly: true,
			sameSite: "Lax",
			expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
		},
	]);
};

const waitForOfflineGraceState = async (page: Page) => {
	await page.waitForFunction(() => {
		const raw = window.localStorage.getItem("oooc_offline_auth_grace_v1");
		if (!raw) return false;
		try {
			const parsed = JSON.parse(raw) as { expiresAt?: number };
			return (
				typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now()
			);
		} catch {
			return false;
		}
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

const setBrowserOffline = async (
	context: BrowserContext,
	page: Page,
	isOffline: boolean,
) => {
	await context.setOffline(isOffline);
	await page.evaluate(
		(offline) =>
			window.dispatchEvent(new Event(offline ? "offline" : "online")),
		isOffline,
	);
};

const markTourSeen = async (page: Page) => {
	await page.addInitScript(() => {
		window.localStorage.setItem("oooc:fete-finder-tour:v1", "skipped");
	});
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
		const mapRegion = page.locator("#event-map");
		await expect(mapRegion).toBeVisible();
		const mapBox = await mapRegion.boundingBox();
		expect(mapBox).not.toBeNull();
		expect(mapBox?.height ?? 0).toBeGreaterThan(200);
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

		await expect(page.locator(".maplibregl-canvas")).toBeVisible();
	});

	test("homepage reloads offline from saved events with search and map fallback", async ({
		context,
		page,
	}) => {
		await verifyUserSession(page);
		await page.goto("/");
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForServiceWorkerReady(page);
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForHomeEventSnapshot(page);
		await waitForOfflineGraceState(page);

		await setBrowserOffline(context, page, true);
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.evaluate(() => window.dispatchEvent(new Event("offline")));

		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
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
				"Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.",
			),
		).toBeVisible();
	});

	test("live session seeds offline grace before protected filters are used offline", async ({
		context,
		page,
	}) => {
		await verifyUserSession(page);
		await page.goto("/?offlineDebug=1");
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		const sessionPayload = await page.evaluate(async () => {
			const response = await fetch("/api/auth/session", { cache: "no-store" });
			return response.json() as Promise<{ isAuthenticated: boolean }>;
		});
		expect(sessionPayload).toMatchObject({ isAuthenticated: true });
		await waitForServiceWorkerReady(page);
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForHomeEventSnapshot(page);
		await waitForOfflineGraceState(page);
		await expect(page.getByText("Auth mode").locator("..")).toContainText(
			"live",
		);
		await expect(
			page.getByText("Protected discovery").locator(".."),
		).toContainText("allowed");

		await setBrowserOffline(context, page, true);
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.evaluate(() => window.dispatchEvent(new Event("offline")));

		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
		await expect(page.getByText("Auth mode").locator("..")).toContainText(
			"offline-grace",
		);
		await expect(
			page.getByText("Protected discovery").locator(".."),
		).toContainText("allowed");
		await page.getByRole("button", { name: /show picks/i }).click();
		await expect(
			page.getByRole("button", { name: /showing picks/i }),
		).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
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

		await setBrowserOffline(context, page, true);
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.evaluate(() => window.dispatchEvent(new Event("offline")));

		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
		await expect(
			page.getByText(
				/Some live details may be unavailable until the app reconnects/,
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
		await verifyUserSession(page);
		await markTourSeen(page);
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
		await waitForOfflineGraceState(page);
		await page
			.locator("#tour-all-events")
			.getByRole("heading", { name: EVENT_TITLE })
			.click();
		await waitForEventDetailSnapshot(page, EVENT_KEY);
		await page.getByRole("button", { name: "Close event details" }).click();

		await page.evaluate(async () => {
			await Promise.allSettled([
				fetch("/api/auth/session"),
				fetch("/api/user/preferences"),
				fetch("/api/admin/health"),
			]);
		});
		const cachedPathnames = await getCachedPathnames(page);
		expect(cachedPathnames).not.toContain("/api/auth/session");
		expect(cachedPathnames).not.toContain("/api/user/preferences");
		expect(cachedPathnames).not.toContain("/api/admin/health");

		await setBrowserOffline(context, page, true);
		await page.reload({ waitUntil: "domcontentloaded" });
		await page.evaluate(() => window.dispatchEvent(new Event("offline")));

		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
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
				"Map style, sprite, glyph, and tile assets are online-only. Cached event browsing, search, and filters are still available below.",
			),
		).toBeVisible();

		await setBrowserOffline(context, page, false);
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
		await expect(page.getByText(/^Cached event data:/)).toHaveCount(0);
		await page.getByRole("button", { name: "Close event details" }).click();
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		assertNoChunkLoadError();
	});

	test("transient offline fallback returns to live events after reconnect", async ({
		context,
		page,
	}) => {
		await page.goto("/");
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForHomeEventSnapshot(page);

		await setBrowserOffline(context, page, true);
		await expect(page.getByText(/^Cached event data:/)).toBeVisible();

		await setBrowserOffline(context, page, false);
		await expect(page.getByText(/^Cached event data:/)).toHaveCount(0);
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
	});

	test("blocked app reachability enters offline fallback even when browser reports online", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(page.locator("#tour-first-event-card")).toBeVisible();
		await waitForHomeEventSnapshot(page);
		expect(await page.evaluate(() => navigator.onLine)).toBe(true);

		await page.route("**/api/client-health?**", (route) => route.abort());
		await page.evaluate(() => window.dispatchEvent(new Event("focus")));

		await expect(page.getByText(/^Cached event data:/)).toBeVisible();
		await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);

		await page.unroute("**/api/client-health?**");
		await page.evaluate(() => window.dispatchEvent(new Event("focus")));

		await expect(page.getByText(/^Cached event data:/)).toHaveCount(0);
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
		const modalBox = await modal.boundingBox();
		expect(modalBox).not.toBeNull();
		expect(modalBox?.x ?? -1).toBeGreaterThanOrEqual(0);
		expect(modalBox?.y ?? -1).toBeGreaterThanOrEqual(0);
		expect(modalBox?.width ?? 0).toBeLessThanOrEqual(390);
		expect(modalBox?.height ?? 0).toBeLessThanOrEqual(844);
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
