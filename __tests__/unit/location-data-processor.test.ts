import { describe, expect, it, vi } from "vitest";

describe("location-aware data processing", () => {
	it("does not fail event processing when coordinate population is requested without a provider", async () => {
		vi.resetModules();
		vi.doMock("@/lib/google/api", () => ({
			GoogleCloudAPI: {
				supportsGeocoding: () => false,
				geocodeAddress: vi.fn(),
			},
		}));

		const { processCSVData } = await import(
			"@/features/data-management/data-processor"
		);
		const csv = ["Title,Date,Location", "Event,2026-06-21,Le Klub"].join(
			"\n",
		);

		const result = await processCSVData(csv, "store", false, {
			populateCoordinates: true,
		});

		expect(result.count).toBe(1);
		expect(result.errors).toEqual([]);
		expect(result.coordinatesPopulated).toBe(false);
	});
});
