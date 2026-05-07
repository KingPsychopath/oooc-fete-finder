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
			{ title: "Recent past", date: "2026-04-20", startTime: "23:00" },
			{ title: "Next up later", date: "2026-04-29", startTime: "23:00" },
			{ title: "Next up earlier", date: "2026-04-29", startTime: "14:00" },
			{ title: "Later", date: "2026-05-03", startTime: "" },
			{ title: "Older past", date: "2026-03-10", startTime: "" },
			{ title: "No date", date: "", startTime: "" },
		];

		const sorted = sortEditableSheetRowsByDefaultDate(rows, {
			referenceDate: new Date("2026-04-28T12:00:00.000Z"),
		});

		expect(sorted.map((row) => row.title)).toEqual([
			"Next up earlier",
			"Next up later",
			"Later",
			"Recent past",
			"Older past",
			"No date",
		]);
	});

	it("uses the shared date normalization for text dates", () => {
		const rows = [
			{ title: "June later", date: "23 June", startTime: "10:00" },
			{ title: "June soonest", date: "21 June", startTime: "23:00" },
			{ title: "June soonest earlier", date: "21 June", startTime: "2 pm" },
		];

		const sorted = sortEditableSheetRowsByDefaultDate(rows, {
			referenceDate: new Date("2026-04-28T12:00:00.000Z"),
		});

		expect(sorted.map((row) => row.title)).toEqual([
			"June soonest earlier",
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
		expect(lines[1]).toContain("Event,21-06-2026");
	});

	it("normalizes parseable dates to day-month-year with dashes when exporting CSV", () => {
		const csv = editableSheetToCsv(
			[
				{ key: "title", label: "Title", isCore: true, isRequired: true },
				{ key: "date", label: "Date", isCore: true, isRequired: true },
			],
			[
				{ title: "ISO", date: "2026-06-21" },
				{ title: "Slash", date: "21/06/2026" },
				{ title: "Text", date: "21 June 2026" },
			],
		);

		expect(
			csv
				.split("\n")
				.slice(1)
				.map((line) => line.split(",").slice(0, 2).join(",")),
		).toEqual(["ISO,21-06-2026", "Slash,21-06-2026", "Text,21-06-2026"]);
	});

	it("normalizes parseable start and end times to 24-hour clock when exporting CSV", () => {
		const csv = editableSheetToCsv(
			[
				{ key: "title", label: "Title", isCore: true, isRequired: true },
				{ key: "date", label: "Date", isCore: true, isRequired: true },
				{
					key: "startTime",
					label: "Start Time",
					isCore: true,
					isRequired: false,
				},
				{ key: "endTime", label: "End Time", isCore: true, isRequired: false },
			],
			[
				{
					title: "Day",
					date: "21-06-2026",
					startTime: "2 pm",
					endTime: "11.30pm",
				},
				{
					title: "Unknown",
					date: "22-06-2026",
					startTime: "TBC",
					endTime: "late maybe",
				},
			],
		);

		expect(
			csv
				.split("\n")
				.slice(1)
				.map((line) => line.split(",").slice(0, 4).join(",")),
		).toEqual([
			"Day,21-06-2026,14:00,23:30",
			"Unknown,22-06-2026,TBC,late maybe",
		]);
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
