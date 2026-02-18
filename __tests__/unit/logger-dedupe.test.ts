import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("server logger dev dedupe", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-18T00:00:00.000Z"));
		vi.resetModules();
		vi.stubEnv("NODE_ENV", "development");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("suppresses repeated info logs with the same payload inside the dedupe window", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const { log } = await import("@/lib/platform/logger");

		log.info("data", "Quality check", { score: 75 });
		log.info("data", "Quality check", { score: 75 });

		expect(logSpy).toHaveBeenCalledTimes(1);
	});

	it("allows the same info log again after the dedupe window", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const { log } = await import("@/lib/platform/logger");

		log.info("data", "Quality check", { score: 75 });
		vi.advanceTimersByTime(1300);
		log.info("data", "Quality check", { score: 75 });

		expect(logSpy).toHaveBeenCalledTimes(2);
	});

	it("does not suppress warnings", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { log } = await import("@/lib/platform/logger");

		log.warn("data", "Potential issue", { reason: "example" });
		log.warn("data", "Potential issue", { reason: "example" });

		expect(warnSpy).toHaveBeenCalledTimes(2);
	});
});
