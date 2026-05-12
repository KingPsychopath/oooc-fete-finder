# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: event-routes.spec.ts >> event share routes >> live session seeds offline grace before protected filters are used offline
- Location: e2e/event-routes.spec.ts:393:6

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#tour-first-event-card')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('#tour-first-event-card')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - link "Fete Finder home" [ref=e7] [cursor=pointer]:
            - /url: /
            - generic [ref=e9]:
              - paragraph [ref=e10]: Out Of Office Collective
              - heading "Fete Finder" [level=1] [ref=e11]
          - navigation "Main" [ref=e12]:
            - link "Home" [ref=e13] [cursor=pointer]:
              - /url: /
            - link "How it works" [ref=e14] [cursor=pointer]:
              - /url: /how-it-works
            - link "Submit Event" [ref=e15] [cursor=pointer]:
              - /url: /submit-event
            - link "Promote" [ref=e16] [cursor=pointer]:
              - /url: /feature-event
            - link "FAQs" [ref=e17] [cursor=pointer]:
              - /url: https://outofofficecollective.co.uk/faqs
          - generic [ref=e18]:
            - generic [ref=e19]:
              - button "🌓 Toggle theme" [disabled]:
                - generic: 🌓
                - generic: Toggle theme
            - button "Quick actions menu" [ref=e22]:
              - img
              - img
        - generic [ref=e26]: Fete de la Musique
    - generic "Curated by Out Of Office Collective. Paris summer rhythm, mapped live. Tap essentials for playlist, food and toilets" [ref=e27]:
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e32]: Curated by Out Of Office Collective
          - generic [ref=e35]: Paris summer rhythm, mapped live
          - generic [ref=e38]: Tap essentials for playlist, food and toilets
          - generic [ref=e41]: Curated by Out Of Office Collective
          - generic [ref=e44]: Paris summer rhythm, mapped live
          - generic [ref=e47]: Tap essentials for playlist, food and toilets
        - generic [ref=e49]:
          - generic [ref=e51]: Curated by Out Of Office Collective
          - generic [ref=e54]: Paris summer rhythm, mapped live
          - generic [ref=e57]: Tap essentials for playlist, food and toilets
          - generic [ref=e60]: Curated by Out Of Office Collective
          - generic [ref=e63]: Paris summer rhythm, mapped live
          - generic [ref=e66]: Tap essentials for playlist, food and toilets
    - main [ref=e68]
  - contentinfo [ref=e94]:
    - generic [ref=e96]:
      - generic [ref=e97]:
        - generic [ref=e98]:
          - generic [ref=e99]: Follow us on socials for updates
          - generic [ref=e100]:
            - link "Visit Out of Office Collective website" [ref=e101] [cursor=pointer]:
              - /url: https://www.outofofficecollective.co.uk/
              - img [ref=e102]
              - img [ref=e105]
            - link "Follow Out of Office Collective on Instagram" [ref=e109] [cursor=pointer]:
              - /url: https://www.instagram.com/outofofficecollectivee/
              - img [ref=e110]
              - img [ref=e112]
            - link "Follow Out of Office Collective on TikTok" [ref=e116] [cursor=pointer]:
              - /url: https://www.tiktok.com/@outofofficecollective
              - img [ref=e117]
              - img [ref=e119]
        - navigation "Footer" [ref=e123]:
          - link "How it works" [ref=e124] [cursor=pointer]:
            - /url: /how-it-works
          - link "Submit your event" [ref=e125] [cursor=pointer]:
            - /url: /submit-event
          - link "Promote" [ref=e126] [cursor=pointer]:
            - /url: /feature-event
          - link "Privacy Policy" [ref=e127] [cursor=pointer]:
            - /url: /privacy
          - link "Contact us" [ref=e128] [cursor=pointer]:
            - /url: https://outofofficecollective.co.uk/contact
          - link "FAQ's" [ref=e129] [cursor=pointer]:
            - /url: https://outofofficecollective.co.uk/faqs
      - generic [ref=e130]:
        - generic [ref=e131]:
          - generic [ref=e132]:
            - generic [ref=e133]: Web app v2.0.0 • Made by
            - link "Milkandhenny" [ref=e134] [cursor=pointer]:
              - /url: https://x.com/milkandh3nny
          - generic [ref=e135]: •
          - link "Buy me a croissant" [ref=e136] [cursor=pointer]:
            - /url: https://coff.ee/milkandhenny
            - img [ref=e137]
            - generic [ref=e143]: Buy me a croissant
        - generic [ref=e144]: Maintained by the OOOC Community
```

# Test source

```ts
  299 | 
  300 | 		await expect(page).toHaveURL(/\/event\/evt_[^/]+\/[^/]+/);
  301 | 		await expect(page.getByRole("dialog")).toBeVisible();
  302 | 		await expect(
  303 | 			page.getByRole("button", { name: "Close event details" }),
  304 | 		).toBeVisible();
  305 | 		await expect(page.getByRole("dialog")).toHaveScreenshot(
  306 | 			"homepage-click-modal.png",
  307 | 		);
  308 | 	});
  309 | 
  310 | 	test("homepage event modal opens promptly without a late layout jump", async ({
  311 | 		page,
  312 | 	}) => {
  313 | 		await page.goto("/");
  314 | 
  315 | 		await page.locator("#tour-first-event-card").click();
  316 | 
  317 | 		const modalCard = page.locator("[data-event-modal-card]");
  318 | 		await expect(modalCard).toBeVisible();
  319 | 
  320 | 		const firstBox = await modalCard.boundingBox();
  321 | 		expect(firstBox).not.toBeNull();
  322 | 		await page.waitForTimeout(700);
  323 | 		const settledBox = await modalCard.boundingBox();
  324 | 		expect(settledBox).not.toBeNull();
  325 | 
  326 | 		expect(Math.abs((settledBox?.x ?? 0) - (firstBox?.x ?? 0))).toBeLessThan(3);
  327 | 		expect(Math.abs((settledBox?.y ?? 0) - (firstBox?.y ?? 0))).toBeLessThan(3);
  328 | 		expect(
  329 | 			Math.abs((settledBox?.width ?? 0) - (firstBox?.width ?? 0)),
  330 | 		).toBeLessThan(3);
  331 | 		expect(
  332 | 			Math.abs((settledBox?.height ?? 0) - (firstBox?.height ?? 0)),
  333 | 		).toBeLessThan(8);
  334 | 	});
  335 | 
  336 | 	test("homepage map stays deferred until map intent", async ({ page }) => {
  337 | 		await page.goto("/");
  338 | 
  339 | 		await expect(
  340 | 			page.getByRole("button", { name: /expand paris event map/i }),
  341 | 		).toBeVisible();
  342 | 		await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  343 | 
  344 | 		await page.getByRole("button", { name: /expand paris event map/i }).click();
  345 | 
  346 | 		await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  347 | 	});
  348 | 
  349 | 	test("homepage reloads offline from saved events with search and map fallback", async ({
  350 | 		context,
  351 | 		page,
  352 | 	}) => {
  353 | 		await page.goto("/");
  354 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  355 | 		await waitForServiceWorkerReady(page);
  356 | 		await page.reload({ waitUntil: "domcontentloaded" });
  357 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  358 | 		await waitForHomeEventSnapshot(page);
  359 | 
  360 | 		await context.setOffline(true);
  361 | 		await page.evaluate(() => {
  362 | 			window.localStorage.setItem(
  363 | 				"oooc_offline_auth_grace_v1",
  364 | 				JSON.stringify({
  365 | 					email: "offline-e2e@example.com",
  366 | 					expiresAt: Date.now() + 60 * 60 * 1000,
  367 | 				}),
  368 | 			);
  369 | 		});
  370 | 		await page.reload({ waitUntil: "domcontentloaded" });
  371 | 
  372 | 		await expect(page.getByText(/^Saved events:/)).toBeVisible();
  373 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  374 | 
  375 | 		const searchInput = page.getByRole("textbox", {
  376 | 			name: "Search events, locations, genres, phases...",
  377 | 		});
  378 | 		await searchInput.fill("Krispy");
  379 | 		await expect(
  380 | 			page
  381 | 				.locator("#tour-all-events")
  382 | 				.getByRole("heading", { name: "Krispy Jam N°29 - Tascha" }),
  383 | 		).toBeVisible();
  384 | 		await expect(page.getByText(/\b1 event found\b/)).toBeVisible();
  385 | 
  386 | 		await expect(
  387 | 			page.getByText(
  388 | 				"Map style, sprite, glyph, and tile assets are online-only. Saved event browsing, search, and filters are still available below.",
  389 | 			),
  390 | 		).toBeVisible();
  391 | 	});
  392 | 
  393 | 	test("live session seeds offline grace before protected filters are used offline", async ({
  394 | 		context,
  395 | 		page,
  396 | 	}) => {
  397 | 		await verifyUserSession(page);
  398 | 		await page.goto("/?offlineDebug=1");
> 399 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  400 | 		const sessionPayload = await page.evaluate(async () => {
  401 | 			const response = await fetch("/api/auth/session", { cache: "no-store" });
  402 | 			return response.json() as Promise<{ isAuthenticated: boolean }>;
  403 | 		});
  404 | 		expect(sessionPayload).toMatchObject({ isAuthenticated: true });
  405 | 		await waitForServiceWorkerReady(page);
  406 | 		await page.reload({ waitUntil: "domcontentloaded" });
  407 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  408 | 		await waitForHomeEventSnapshot(page);
  409 | 		await waitForOfflineGraceState(page);
  410 | 		await expect(page.getByText("Auth mode").locator("..")).toContainText(
  411 | 			"live",
  412 | 		);
  413 | 		await expect(
  414 | 			page.getByText("Protected discovery").locator(".."),
  415 | 		).toContainText("allowed");
  416 | 
  417 | 		await context.setOffline(true);
  418 | 		await page.reload({ waitUntil: "domcontentloaded" });
  419 | 
  420 | 		await expect(page.getByText(/^Saved events:/)).toBeVisible();
  421 | 		await expect(page.getByText("Auth mode").locator("..")).toContainText(
  422 | 			"offline-grace",
  423 | 		);
  424 | 		await expect(
  425 | 			page.getByText("Protected discovery").locator(".."),
  426 | 		).toContainText("allowed");
  427 | 		await page.getByRole("button", { name: /show picks/i }).click();
  428 | 		await expect(
  429 | 			page.getByRole("button", { name: /showing picks/i }),
  430 | 		).toBeVisible();
  431 | 		await expect(page.getByRole("dialog")).toHaveCount(0);
  432 | 	});
  433 | 
  434 | 	test("event modal reopens offline from saved event detail", async ({
  435 | 		context,
  436 | 		page,
  437 | 	}) => {
  438 | 		await page.goto("/");
  439 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  440 | 		await waitForServiceWorkerReady(page);
  441 | 		await page.reload({ waitUntil: "domcontentloaded" });
  442 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  443 | 		await waitForHomeEventSnapshot(page);
  444 | 
  445 | 		await page
  446 | 			.locator("#tour-all-events")
  447 | 			.getByRole("heading", { name: EVENT_TITLE })
  448 | 			.click();
  449 | 		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
  450 | 		await waitForEventDetailSnapshot(page, EVENT_KEY);
  451 | 
  452 | 		await context.setOffline(true);
  453 | 		await page.reload({ waitUntil: "domcontentloaded" });
  454 | 
  455 | 		await expect(page.getByRole("dialog", { name: EVENT_TITLE })).toBeVisible();
  456 | 		await expect(
  457 | 			page.getByText(
  458 | 				/Some live details may be unavailable until you are back online/,
  459 | 			),
  460 | 		).toBeVisible();
  461 | 		await expect(
  462 | 			page.getByRole("button", { name: "Close event details" }),
  463 | 		).toBeVisible();
  464 | 	});
  465 | 
  466 | 	test("offline acceptance pass covers PWA cache boundaries and reconnect", async ({
  467 | 		context,
  468 | 		page,
  469 | 	}) => {
  470 | 		const assertNoChunkLoadError = failOnChunkLoadError(page);
  471 | 		await page.goto("/");
  472 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  473 | 		await waitForServiceWorkerReady(page);
  474 | 		await waitForServiceWorkerController(page);
  475 | 		await waitForNextStaticCache(page);
  476 | 		await page.reload({ waitUntil: "domcontentloaded" });
  477 | 		await expect(page.locator("#tour-first-event-card")).toBeVisible();
  478 | 
  479 | 		const serviceWorkerState = await page.evaluate(() => ({
  480 | 			hasController: Boolean(navigator.serviceWorker.controller),
  481 | 			manifestHref:
  482 | 				document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ??
  483 | 				null,
  484 | 		}));
  485 | 		expect(serviceWorkerState.hasController).toBe(true);
  486 | 		expect(serviceWorkerState.manifestHref).toContain("/manifest.webmanifest");
  487 | 		await waitForNextStaticCache(page);
  488 | 
  489 | 		await waitForHomeEventSnapshot(page);
  490 | 		await page
  491 | 			.locator("#tour-all-events")
  492 | 			.getByRole("heading", { name: EVENT_TITLE })
  493 | 			.click();
  494 | 		await waitForEventDetailSnapshot(page, EVENT_KEY);
  495 | 		await page.getByRole("button", { name: "Close event details" }).click();
  496 | 
  497 | 		await page.evaluate(async () => {
  498 | 			await Promise.allSettled([
  499 | 				fetch("/api/auth/session"),
```