import { createDateNormalizationContext } from "@/features/data-management/assembly/date-normalization";
import {
	editableSheetToCsv,
	getEditableSheetDateRangeDates,
	pruneEmptyEditableSheetRows,
	sortEditableSheetRowsByDefaultDate,
	splitEditableSheetRangeRow,
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

	it("normalizes Date To when exporting source CSV", () => {
		const csv = editableSheetToCsv(
			[
				{ key: "title", label: "Title", isCore: true, isRequired: true },
				{ key: "date", label: "Date", isCore: true, isRequired: true },
				{ key: "dateTo", label: "Date To", isCore: true, isRequired: false },
			],
			[
				{
					title: "Range",
					date: "21 June 2026",
					dateTo: "23 June 2026",
				},
			],
		);

		expect(csv.split("\n")[1]?.startsWith("Range,21-06-2026,23-06-2026")).toBe(
			true,
		);
	});

	it("can materialize a range row into editable per-day rows", () => {
		const rows = [
			{
				eventKey: "evt_explicitrange123",
				title: "Range",
				date: "21 June 2026",
				dateTo: "23 June 2026",
				startTime: "19:00",
			},
		];

		const nextRows = splitEditableSheetRangeRow(rows, 0);

		expect(nextRows).toHaveLength(3);
		expect(nextRows.map((row) => row.date)).toEqual([
			"21-06-2026",
			"22-06-2026",
			"23-06-2026",
		]);
		expect(nextRows.every((row) => row.dateTo === "")).toBe(true);
		expect(nextRows.every((row) => row.seriesKey?.startsWith("ser_"))).toBe(
			true,
		);
		expect(nextRows[0].eventKey).toBe("evt_explicitrange123");
		expect(nextRows[1].eventKey).toBe("");
	});

	it("can split one date out while preserving compact surrounding ranges", () => {
		const rows = [
			{
				eventKey: "evt_explicitrange123",
				title: "Range",
				date: "21 June 2026",
				dateTo: "24 June 2026",
				startTime: "19:00",
			},
		];

		const context = createDateNormalizationContext([
			{ date: rows[0].date, dateTo: rows[0].dateTo },
		]);
		expect(getEditableSheetDateRangeDates(rows[0], context)).toEqual([
			"2026-06-21",
			"2026-06-22",
			"2026-06-23",
			"2026-06-24",
		]);

		const nextRows = splitEditableSheetRangeRow(rows, 0, "2026-06-23");

		expect(nextRows.map((row) => [row.date, row.dateTo])).toEqual([
			["21-06-2026", "22-06-2026"],
			["23-06-2026", ""],
			["24-06-2026", ""],
		]);
		expect(new Set(nextRows.map((row) => row.seriesKey)).size).toBe(1);
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
