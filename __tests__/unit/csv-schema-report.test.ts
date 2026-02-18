import { describe, expect, it } from "vitest";
import { analyzeCsvSchemaRows } from "@/features/data-management/validation/csv-schema-report";

describe("analyzeCsvSchemaRows", () => {
	it("blocks missing event keys when eventKeyMode is error", () => {
		const report = analyzeCsvSchemaRows([
			{
				name: "Event",
				date: "2026-06-21",
				eventKey: "",
			},
		], { eventKeyMode: "error" });

		expect(report.hasBlockingIssues).toBe(true);
		expect(report.blockingCount).toBeGreaterThan(0);
		expect(report.issues.some((issue) => issue.code === "event_key_missing")).toBe(
			true,
		);
	});

	it("warns on missing event keys without blocking import", () => {
		const report = analyzeCsvSchemaRows([
			{
				name: "Event",
				date: "21 June",
				eventKey: "",
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
			},
		]);

		expect(report.issues.some((issue) => issue.code === "nationality_unsupported")).toBe(
			true,
		);
	});
});
