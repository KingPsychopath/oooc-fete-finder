import {
	editableSheetToCsv,
	pruneEmptyEditableSheetRows,
	sortEditableSheetRowsByDefaultDate,
	validateEditableSheet,
} from "@/features/data-management/csv/sheet-editor";
import { describe, expect, it } from "vitest";

describe("sortEditableSheetRowsByDefaultDate", () => {
	it("sorts upcoming rows soonest first, then past rows newest first", () => {
		const rows = [
			{ title: "Recent past", date: "2026-04-20" },
			{ title: "Next up", date: "2026-04-29" },
			{ title: "Later", date: "2026-05-03" },
			{ title: "Older past", date: "2026-03-10" },
			{ title: "No date", date: "" },
		];

		const sorted = sortEditableSheetRowsByDefaultDate(rows, {
			referenceDate: new Date("2026-04-28T12:00:00.000Z"),
		});

		expect(sorted.map((row) => row.title)).toEqual([
			"Next up",
			"Later",
			"Recent past",
			"Older past",
			"No date",
		]);
	});

	it("uses the shared date normalization for text dates", () => {
		const rows = [
			{ title: "June later", date: "23 June" },
			{ title: "June soonest", date: "21 June" },
		];

		const sorted = sortEditableSheetRowsByDefaultDate(rows, {
			referenceDate: new Date("2026-04-28T12:00:00.000Z"),
		});

		expect(sorted.map((row) => row.title)).toEqual([
			"June soonest",
			"June later",
		]);
	});

	it("normalizes country emoji and names to codes when exporting CSV", () => {
		const csv = editableSheetToCsv(
			[
				{
					key: "hostCountry",
					label: "Host Country",
					isCore: true,
					isRequired: false,
				},
				{
					key: "audienceCountry",
					label: "Audience Country",
					isCore: true,
					isRequired: false,
				},
				{ key: "title", label: "Title", isCore: true, isRequired: true },
				{ key: "date", label: "Date", isCore: true, isRequired: true },
			],
			[
				{
					hostCountry: "🇫🇷 / Spain",
					audienceCountry: "🇬🇧, United States",
					title: "Event",
					date: "2026-06-21",
				},
			],
		);

		expect(csv).toContain('"FR, ES"');
		expect(csv).toContain('"UK, US"');
	});

	it("prunes fully empty rows before exporting CSV", () => {
		const csv = editableSheetToCsv(
			[
				{ key: "title", label: "Title", isCore: true, isRequired: true },
				{ key: "date", label: "Date", isCore: true, isRequired: true },
			],
			[
				{ title: "", date: "" },
				{ title: "Event", date: "2026-06-21" },
				{ title: "   ", date: "" },
			],
		);

		const lines = csv.split("\n");
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("Title,Date");
		expect(lines[1]).toContain("Event,2026-06-21");
	});

	it("validates against pruned empty rows and rejects incomplete populated drafts", () => {
		const columns = [
			{ key: "title", label: "Title", isCore: true, isRequired: true },
			{ key: "date", label: "Date", isCore: true, isRequired: true },
		];
		const rows = [
			{ title: "", date: "" },
			{ title: "Draft missing date", date: "" },
		];

		expect(pruneEmptyEditableSheetRows(rows)).toEqual([
			{ title: "Draft missing date", date: "" },
		]);
		expect(validateEditableSheet(columns, rows)).toMatchObject({
			valid: false,
			error: "Row 1 is missing required Date.",
			rows: [{ title: "Draft missing date", date: "" }],
		});
	});
});
