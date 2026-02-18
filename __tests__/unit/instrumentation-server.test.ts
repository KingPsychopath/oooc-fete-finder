import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("instrumentation.server", () => {
	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("warns when GOOGLE_SERVICE_ACCOUNT_KEY is malformed JSON", async () => {
		process.env.GOOGLE_SERVICE_ACCOUNT_KEY = "{not-json";
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const { runNodeInstrumentation } = await import(
			"@/instrumentation.server"
		);
		await runNodeInstrumentation();

		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalledWith(
			"[fete-finder] Warning | GOOGLE_SERVICE_ACCOUNT_KEY is set but is not valid JSON.",
		);
	});

	it("does not warn when GOOGLE_SERVICE_ACCOUNT_KEY is valid", async () => {
		process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
			client_email: "service-account@example.iam.gserviceaccount.com",
			private_key: "-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----\n",
		});
		vi.spyOn(console, "log").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const { runNodeInstrumentation } = await import(
			"@/instrumentation.server"
		);
		await runNodeInstrumentation();

		expect(warnSpy).not.toHaveBeenCalled();
	});
});
