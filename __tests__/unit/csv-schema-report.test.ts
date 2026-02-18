import { describe, expect, it } from "vitest";
import { analyzeCsvSchemaRows } from "@/features/data-management/validation/csv-schema-report";

describe("analyzeCsvSchemaRows", () => {
	it("flags legacy featured values as blocking", () => {
		const report = analyzeCsvSchemaRows([
			{
				name: "Event",
				date: "2026-06-21",
				featured: "2026-06-01T00:00:00Z",
			},
		]);

		expect(report.hasBlockingIssues).toBe(true);
		expect(report.blockingCount).toBeGreaterThan(0);
		expect(report.issues.some((issue) => issue.code === "featured_legacy_value")).toBe(
			true,
		);
	});

	it("warns on missing event keys without blocking import", () => {
		const report = analyzeCsvSchemaRows([
			{
				name: "Event",
				date: "21 June",
				eventKey: "",
				featured: "",
			},
		]);

		expect(report.hasBlockingIssues).toBe(false);
		expect(report.warningCount).toBeGreaterThan(0);
		expect(report.issues.some((issue) => issue.code === "event_key_missing")).toBe(
			true,
		);
		expect(report.issues.some((issue) => issue.code === "date_missing_year")).toBe(
			true,
		);
	});

	it("warns on unsupported nationality tokens", () => {
		const report = analyzeCsvSchemaRows([
			{
				name: "Event",
				date: "2026-06-21",
				nationality: "🇫🇷🇩🇪",
				featured: "",
			},
		]);

		expect(report.issues.some((issue) => issue.code === "nationality_unsupported")).toBe(
			true,
		);
	});
});
