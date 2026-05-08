import { expect, test } from "@playwright/test";

const EVENT_PATH = "/event/evt_115811d709b9b6ed/krispy-jam-n-29-tascha";
const EVENT_TITLE = "Krispy Jam N°29 - Tascha";

test.describe("event share routes", () => {
	test("direct event URL renders the hydrated modal", async ({ page }) => {
		await page.goto(EVENT_PATH);

		const modal = page.getByRole("dialog", { name: EVENT_TITLE });
		await expect(modal).toBeVisible();
		await expect(page.getByRole("button", { name: "Close event details" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Browse all events" })).toBeHidden();
		await expect(modal).toHaveScreenshot("direct-event-modal.png");
	});

	test("closing a direct event URL lands cleanly on the homepage", async ({ page }) => {
		await page.goto(EVENT_PATH);
		await page.getByRole("button", { name: "Close event details" }).click();

		await expect(page).toHaveURL("/");
		await expect(page.getByText("Discover events across the city")).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator("#event-map")).toHaveScreenshot("close-to-home-map.png");
	});

	test("homepage card clicks open an event modal without a full page navigation flash", async ({
		page,
	}) => {
		await page.goto("/");

		await page.locator("#tour-first-event-card").click();

		await expect(page).toHaveURL(/\/event\/evt_[^/]+\/[^/]+/);
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page.getByRole("button", { name: "Close event details" })).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveScreenshot(
			"homepage-click-modal.png",
		);
	});

	test("homepage event modal opens promptly without a late layout jump", async ({
		page,
	}) => {
		await page.goto("/");

		const openedAt = Date.now();
		await page.locator("#tour-first-event-card").click();

		const modalCard = page.locator("[data-event-modal-card]");
		await expect(modalCard).toBeVisible();
		expect(Date.now() - openedAt).toBeLessThan(750);

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
			page.getByRole("button", { name: /expand to load the live paris map/i }),
		).toBeVisible();
		await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);

		await page
			.getByRole("button", { name: /expand to load the live paris map/i })
			.click();

		await expect(page.getByText("MapLibre", { exact: true })).toBeVisible();
	});
});

test.describe("event share routes on mobile", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("direct event URL is framed correctly on mobile", async ({ page }) => {
		await page.goto(EVENT_PATH);

		const modal = page.getByRole("dialog", { name: EVENT_TITLE });
		await expect(modal).toBeVisible();
		await expect(page.getByRole("button", { name: "Close event details" })).toBeVisible();
		await expect(modal).toHaveScreenshot("mobile-direct-event-modal.png");
	});
});

test.describe("event share routes without JavaScript", () => {
	test.use({ javaScriptEnabled: false });

	test("direct event URL keeps a server-rendered modal preview", async ({ page }) => {
		await page.goto(EVENT_PATH);

		const preview = page.locator("section").filter({ hasText: EVENT_TITLE });
		await expect(preview).toBeVisible();
		await expect(page.getByRole("link", { name: "Close event details" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Browse all events" })).toBeVisible();
		await expect(preview).toHaveScreenshot("no-js-event-preview.png");
	});
});
