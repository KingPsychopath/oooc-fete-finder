import type {
	EditableSheetColumn,
	EditableSheetRow,
} from "@/features/data-management/csv/sheet-editor";
import type { EventSheetRevisionChangeSummary } from "./event-sheet-revision-types";

type IndexedSheetRow = {
	row: EditableSheetRow;
	index: number;
};

const FALLBACK_NATURAL_KEY_COLUMNS = ["title", "date", "location"] as const;

const normalizeComparableValue = (value: unknown): string =>
	String(value ?? "").trim();

const normalizeComparableKeyPart = (value: unknown): string =>
	normalizeComparableValue(value).toLowerCase().replace(/\s+/g, " ");

const getEventKeyIdentity = (row: EditableSheetRow): string | null => {
	const eventKey = normalizeComparableKeyPart(row.eventKey);
	return eventKey ? `event:${eventKey}` : null;
};

const getPrimaryUrlIdentity = (row: EditableSheetRow): string | null => {
	const primaryUrl = normalizeComparableKeyPart(row.primaryUrl);
	return primaryUrl ? `url:${primaryUrl}` : null;
};

const getNaturalIdentity = (row: EditableSheetRow): string | null => {
	const parts = FALLBACK_NATURAL_KEY_COLUMNS.map((key) =>
		normalizeComparableKeyPart(row[key]),
	);
	const populatedParts = parts.filter(Boolean);
	if (populatedParts.length < 2) return null;
	return `natural:${parts.join("|")}`;
};

const findMatchingBeforeRow = (
	remainingBeforeRows: IndexedSheetRow[],
	afterRow: EditableSheetRow,
	afterIndex: number,
	allowIndexFallback: boolean,
): IndexedSheetRow | null => {
	const strategies = [
		getEventKeyIdentity,
		getPrimaryUrlIdentity,
		getNaturalIdentity,
	] as const;

	for (const getIdentity of strategies) {
		const identity = getIdentity(afterRow);
		if (!identity) continue;
		const matchIndex = remainingBeforeRows.findIndex(
			(item) => getIdentity(item.row) === identity,
		);
		if (matchIndex >= 0) {
			const [match] = remainingBeforeRows.splice(matchIndex, 1);
			return match ?? null;
		}
	}

	if (allowIndexFallback) {
		const matchIndex = remainingBeforeRows.findIndex(
			(item) =>
				item.index === afterIndex &&
				(!getEventKeyIdentity(item.row) || !getEventKeyIdentity(afterRow)),
		);
		if (matchIndex >= 0) {
			const [match] = remainingBeforeRows.splice(matchIndex, 1);
			return match ?? null;
		}
	}

	return null;
};

export const buildEventSheetChangeSummary = (
	beforeRows: EditableSheetRow[],
	afterRows: EditableSheetRow[],
	columns: EditableSheetColumn[],
): EventSheetRevisionChangeSummary => {
	const remainingBeforeRows = beforeRows.map((row, index) => ({
		row,
		index,
	}));
	const changedColumnLabels = new Set<string>();
	const addedRows: EditableSheetRow[] = [];
	let changedRows = 0;
	const allowIndexFallback = beforeRows.length === afterRows.length;

	for (const [afterIndex, afterRow] of afterRows.entries()) {
		const beforeMatch = findMatchingBeforeRow(
			remainingBeforeRows,
			afterRow,
			afterIndex,
			allowIndexFallback,
		);
		if (!beforeMatch) {
			addedRows.push(afterRow);
			continue;
		}

		let rowChanged = false;
		for (const column of columns) {
			if (
				normalizeComparableValue(beforeMatch.row[column.key]) ===
				normalizeComparableValue(afterRow[column.key])
			) {
				continue;
			}
			rowChanged = true;
			changedColumnLabels.add(column.label || column.key);
		}
		if (rowChanged) changedRows += 1;
	}

	const deletedRows = remainingBeforeRows.map((item) => item.row);

	return {
		addedRows: addedRows.length,
		deletedRows: deletedRows.length,
		changedRows,
		changedColumns: [...changedColumnLabels].slice(0, 12),
		sampleAdded: addedRows
			.map(
				(row) => row.title?.trim() || row.eventKey?.trim() || "Untitled event",
			)
			.slice(0, 3),
		sampleDeleted: deletedRows
			.map(
				(row) => row.title?.trim() || row.eventKey?.trim() || "Untitled event",
			)
			.slice(0, 3),
	};
};
