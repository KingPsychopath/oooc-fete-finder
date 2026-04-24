import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("instrumentation.server", () => {
	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("logs startup readiness", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const { runNodeInstrumentation } = await import("@/instrumentation.server");
		await runNodeInstrumentation();

		expect(logSpy).toHaveBeenCalledTimes(1);
	});
});
