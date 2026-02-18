import { describe, expect, it } from "vitest";

describe("processCSVData date normalization", () => {
	it("normalizes mixed date formats and keeps invalid rows as tbc", async () => {
		process.env.AUTH_SECRET ??= "test-auth-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
		const { processCSVData } = await import(
			"@/features/data-management/data-processor"
		);

		const csv = [
			"Title,Date,Location",
			"Explicit Year,2026-06-21,Paris",
			"Yearless,21 June,Paris",
			"Ambiguous,03/04/2026,Paris",
			"Invalid,31/02/2026,Paris",
		].join("\n");

		const result = await processCSVData(csv, "store", false, {
			populateCoordinates: false,
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});

		expect(result.count).toBe(4);

		const explicit = result.events.find((event) => event.name === "Explicit Year");
		const yearless = result.events.find((event) => event.name === "Yearless");
		const ambiguous = result.events.find((event) => event.name === "Ambiguous");
		const invalid = result.events.find((event) => event.name === "Invalid");

		expect(explicit?.date).toBe("2026-06-21");
		expect(explicit?.day).toBe("sunday");

		expect(yearless?.date).toBe("2026-06-21");
		expect(yearless?.day).toBe("sunday");

		expect(ambiguous?.date).toBe("");
		expect(ambiguous?.day).toBe("tbc");
		expect(invalid?.date).toBe("");
		expect(invalid?.day).toBe("tbc");

		const warningTypes = result.warnings.map((warning) => warning.warningType);
		expect(warningTypes).toContain("inferred_year");
		expect(warningTypes).toContain("ambiguous");
		expect(warningTypes).toContain("invalid");
	});
});
