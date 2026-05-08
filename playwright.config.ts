import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
	testDir: "./e2e",
	timeout: 30_000,
	expect: {
		timeout: 10_000,
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.015,
		},
	},
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { viewport: { width: 1440, height: 1000 } },
		},
	],
	webServer: {
		command: "pnpm start",
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
