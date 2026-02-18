import { describe, expect, it } from "vitest";
import {
	createDateNormalizationContext,
	normalizeCsvDate,
} from "@/features/data-management/assembly/date-normalization";
import type { CSVEventRow } from "@/features/data-management/csv/parser";

const makeRow = (date: string): CSVEventRow => ({
	eventKey: "",
	curated: "",
	hostCountry: "",
	audienceCountry: "",
	title: "Sample Event",
	date,
	startTime: "",
	endTime: "",
	location: "Paris",
	districtArea: "11",
	categories: "",
	tags: "",
	price: "",
	primaryUrl: "",
	ageGuidance: "",
	setting: "",
	notes: "",
});

describe("date normalization", () => {
	it("normalizes explicit-year textual dates and computes weekday", () => {
		const context = createDateNormalizationContext([makeRow("21 June 2026")], {
			referenceDate: new Date("2024-01-01T00:00:00.000Z"),
		});
		const normalized = normalizeCsvDate("21 June 2026", context);

		expect(normalized.isoDate).toBe("2026-06-21");
		expect(normalized.day).toBe("sunday");
		expect(normalized.warning).toBeUndefined();
	});

	it("infers missing years from majority explicit year", () => {
		const rows = [
			makeRow("2027-06-21"),
			makeRow("21 June 2027"),
			makeRow("2026-06-20"),
			makeRow("21 June"),
		];
		const context = createDateNormalizationContext(rows, {
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});
		const normalized = normalizeCsvDate("21 June", context);

		expect(context.inferredYear).toBe(2027);
		expect(normalized.isoDate).toBe("2027-06-21");
		expect(normalized.warning?.type).toBe("inferred_year");
	});

	it("falls back to reference year when no explicit years exist", () => {
		const context = createDateNormalizationContext([makeRow("29 February")], {
			referenceDate: new Date("2024-11-08T00:00:00.000Z"),
		});
		const normalized = normalizeCsvDate("29 February", context);

		expect(context.inferredYear).toBe(2024);
		expect(normalized.isoDate).toBe("2024-02-29");
		expect(normalized.warning?.type).toBe("inferred_year");
	});

	it("breaks inferred-year ties by nearest reference year then larger year", () => {
		const rows = [makeRow("2024-06-21"), makeRow("2026-06-21"), makeRow("21 June")];
		const context = createDateNormalizationContext(rows, {
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});
		const normalized = normalizeCsvDate("21 June", context);

		expect(context.inferredYear).toBe(2026);
		expect(normalized.isoDate).toBe("2026-06-21");
	});

	it("rejects ambiguous numeric dates", () => {
		const context = createDateNormalizationContext([makeRow("2026-06-21")], {
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});
		const normalized = normalizeCsvDate("03/04/2026", context);

		expect(normalized.isoDate).toBe("");
		expect(normalized.day).toBe("tbc");
		expect(normalized.warning?.type).toBe("ambiguous");
	});

	it("rejects impossible calendar dates", () => {
		const context = createDateNormalizationContext([makeRow("2026-06-21")], {
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});
		const normalized = normalizeCsvDate("31/02/2026", context);

		expect(normalized.isoDate).toBe("");
		expect(normalized.day).toBe("tbc");
		expect(normalized.warning?.type).toBe("invalid");
	});

	it("rejects unparseable formats", () => {
		const context = createDateNormalizationContext([makeRow("2026-06-21")], {
			referenceDate: new Date("2025-01-01T00:00:00.000Z"),
		});
		const normalized = normalizeCsvDate("next friday maybe", context);

		expect(normalized.isoDate).toBe("");
		expect(normalized.day).toBe("tbc");
		expect(normalized.warning?.type).toBe("unparseable");
	});
});
