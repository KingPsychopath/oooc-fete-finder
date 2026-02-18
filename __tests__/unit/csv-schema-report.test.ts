import { describe, expect, it } from "vitest";
import { analyzeCsvSchemaRows } from "@/features/data-management/validation/csv-schema-report";

describe("analyzeCsvSchemaRows", () => {
	it("flags legacy featured values as blocking", () => {
		const report = analyzeCsvSchemaRows([
			{
				title: "Event",
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

	it("blocks missing event keys when eventKeyMode is error", () => {
		const report = analyzeCsvSchemaRows([
			{
				title: "Event",
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
				title: "Event",
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

	it("warns on unsupported host and audience country tokens", () => {
		const report = analyzeCsvSchemaRows([
			{
				title: "Event",
				date: "2026-06-21",
				hostCountry: "🇫🇷🇩🇪",
				audienceCountry: "UK + DE",
			},
		]);

		const countryIssues = report.issues.filter(
			(issue) => issue.code === "nationality_unsupported",
		);
		expect(countryIssues.length).toBe(2);
		expect(countryIssues.some((issue) => issue.column === "Host Country")).toBe(
			true,
		);
		expect(
			countryIssues.some((issue) => issue.column === "Audience Country"),
		).toBe(true);
	});
});
