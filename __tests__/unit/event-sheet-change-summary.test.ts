import type {
	EditableSheetColumn,
	EditableSheetRow,
} from "@/features/data-management/csv/sheet-editor";
import { buildEventSheetChangeSummary } from "@/features/data-management/event-sheet-change-summary";
import { describe, expect, it } from "vitest";

const columns: EditableSheetColumn[] = [
	{ key: "eventKey", label: "Event Key", isCore: true, isRequired: false },
	{ key: "title", label: "Title", isCore: true, isRequired: true },
	{ key: "date", label: "Date", isCore: true, isRequired: true },
	{ key: "startTime", label: "Start Time", isCore: true, isRequired: false },
	{ key: "location", label: "Location", isCore: true, isRequired: false },
	{ key: "primaryUrl", label: "Primary URL", isCore: true, isRequired: false },
	{ key: "price", label: "Price", isCore: true, isRequired: false },
];

describe("buildEventSheetChangeSummary", () => {
	it("treats ordinary edits on keyed rows as changed rows", () => {
		const beforeRows: EditableSheetRow[] = [
			{
				eventKey: "evt_party",
				title: "Party",
				date: "21-06-2026",
				location: "Old Room",
				price: "Free",
			},
		];
		const afterRows: EditableSheetRow[] = [
			{
				eventKey: "EVT_PARTY",
				title: "Party",
				date: "21-06-2026",
				location: "New Room",
				price: "5",
			},
		];

		expect(buildEventSheetChangeSummary(beforeRows, afterRows, columns)).toEqual({
			addedRows: 0,
			deletedRows: 0,
			changedRows: 1,
			changedColumns: ["Event Key", "Location", "Price"],
			sampleAdded: [],
			sampleDeleted: [],
		});
	});

	it("matches generated event-key churn by URL or row position instead of reporting add/delete churn", () => {
		const beforeRows: EditableSheetRow[] = [
			{
				eventKey: "evt_oldgenerated",
				title: "Editable Party",
				date: "21-06-2026",
				startTime: "20:00",
				location: "Paris",
				primaryUrl: "https://example.com/party",
			},
		];
		const afterRows: EditableSheetRow[] = [
			{
				eventKey: "evt_newgenerated",
				title: "Editable Party renamed",
				date: "21-06-2026",
				startTime: "21:00",
				location: "Paris",
				primaryUrl: "https://example.com/party",
			},
		];

		const summary = buildEventSheetChangeSummary(beforeRows, afterRows, columns);

		expect(summary.addedRows).toBe(0);
		expect(summary.deletedRows).toBe(0);
		expect(summary.changedRows).toBe(1);
		expect(summary.changedColumns).toEqual([
			"Event Key",
			"Title",
			"Start Time",
		]);
	});

	it("still reports true added and deleted rows", () => {
		const beforeRows: EditableSheetRow[] = [
			{
				eventKey: "evt_keep",
				title: "Keep",
				date: "21-06-2026",
			},
			{
				eventKey: "evt_delete",
				title: "Delete",
				date: "22-06-2026",
			},
		];
		const afterRows: EditableSheetRow[] = [
			{
				eventKey: "evt_keep",
				title: "Keep",
				date: "21-06-2026",
			},
			{
				eventKey: "evt_add",
				title: "Add",
				date: "23-06-2026",
			},
		];

		const summary = buildEventSheetChangeSummary(beforeRows, afterRows, columns);

		expect(summary.addedRows).toBe(1);
		expect(summary.deletedRows).toBe(1);
		expect(summary.changedRows).toBe(0);
		expect(summary.sampleAdded).toEqual(["Add"]);
		expect(summary.sampleDeleted).toEqual(["Delete"]);
	});
});
