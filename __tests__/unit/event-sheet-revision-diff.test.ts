import type {
	EditableSheetColumn,
	EditableSheetRow,
} from "@/features/data-management/csv/sheet-editor";
import { buildRevisionDiff } from "@/features/data-management/event-sheet-revision-diff";
import { describe, expect, it } from "vitest";

const columns: EditableSheetColumn[] = [
	{ key: "eventKey", label: "Event Key", isCore: true, isRequired: false },
	{ key: "title", label: "Title", isCore: true, isRequired: true },
	{ key: "date", label: "Date", isCore: true, isRequired: true },
	{ key: "location", label: "Location", isCore: true, isRequired: false },
	{ key: "price", label: "Price", isCore: true, isRequired: false },
];

describe("buildRevisionDiff", () => {
	it("classifies rows that would be added and removed when loading a revision", () => {
		const currentRows: EditableSheetRow[] = [
			{
				eventKey: "evt_keep",
				title: "Keep Me",
				date: "2026-06-21",
				location: "Paris",
			},
			{
				eventKey: "evt_current_only",
				title: "Current Only",
				date: "2026-06-22",
				location: "Lyon",
			},
		];
		const revisionRows: EditableSheetRow[] = [
			{
				eventKey: "evt_keep",
				title: "Keep Me",
				date: "2026-06-21",
				location: "Paris",
			},
			{
				eventKey: "evt_revision_only",
				title: "Revision Only",
				date: "2026-06-23",
				location: "Marseille",
			},
		];

		const diff = buildRevisionDiff({ columns, currentRows, revisionRows });

		expect(diff.added.map((row) => row.label)).toEqual(["Revision Only"]);
		expect(diff.deleted.map((row) => row.label)).toEqual(["Current Only"]);
		expect(diff.changed).toEqual([]);
	});

	it("reports field-level changes for matched event keys", () => {
		const currentRows: EditableSheetRow[] = [
			{
				eventKey: "evt_same",
				title: "Same Party",
				date: "2026-06-21",
				location: "Old Venue",
				price: "10",
			},
		];
		const revisionRows: EditableSheetRow[] = [
			{
				eventKey: "evt_same",
				title: "Same Party",
				date: "2026-06-21",
				location: "New Venue",
				price: "12",
			},
		];

		const diff = buildRevisionDiff({ columns, currentRows, revisionRows });

		expect(diff.added).toEqual([]);
		expect(diff.deleted).toEqual([]);
		expect(diff.changed).toHaveLength(1);
		expect(diff.changed[0]?.changedCells).toEqual([
			{
				key: "location",
				label: "Location",
				currentValue: "Old Venue",
				revisionValue: "New Venue",
			},
			{
				key: "price",
				label: "Price",
				currentValue: "10",
				revisionValue: "12",
			},
		]);
	});

	it("uses title, date, and location as the fallback identity when eventKey is absent", () => {
		const currentRows: EditableSheetRow[] = [
			{
				title: "Fallback Party",
				date: "2026-06-21",
				location: "Paris",
				price: "Free",
			},
		];
		const revisionRows: EditableSheetRow[] = [
			{
				title: "Fallback Party",
				date: "2026-06-21",
				location: "Paris",
				price: "5",
			},
		];

		const diff = buildRevisionDiff({ columns, currentRows, revisionRows });

		expect(diff.added).toEqual([]);
		expect(diff.deleted).toEqual([]);
		expect(diff.changed).toHaveLength(1);
		expect(diff.changed[0]?.changedCells).toEqual([
			{
				key: "price",
				label: "Price",
				currentValue: "Free",
				revisionValue: "5",
			},
		]);
	});
});
