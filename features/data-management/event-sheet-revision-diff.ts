import type {
	EditableSheetColumn,
	EditableSheetRow,
} from "@/features/data-management/csv/sheet-editor";

export type RevisionDiffCell = {
	key: string;
	label: string;
	currentValue: string;
	revisionValue: string;
};

export type RevisionRowDiff = {
	key: string;
	label: string;
	subtitle: string;
	type: "added" | "deleted" | "changed";
	changedCells: RevisionDiffCell[];
};

export type RevisionDiff = {
	added: RevisionRowDiff[];
	deleted: RevisionRowDiff[];
	changed: RevisionRowDiff[];
};

type BuildRevisionDiffInput = {
	columns: EditableSheetColumn[];
	currentRows: EditableSheetRow[];
	revisionRows: EditableSheetRow[];
};

const IDENTITY_COLUMN_KEYS = ["eventKey", "title", "date", "location"];
const SUBTITLE_COLUMN_KEYS = ["date", "location"];

const normalizeCellValue = (value: unknown): string =>
	String(value ?? "").trim();

const normalizeIdentityPart = (value: unknown): string =>
	normalizeCellValue(value).toLowerCase();

const buildRowIdentity = (row: EditableSheetRow, index: number): string => {
	const eventKey = normalizeIdentityPart(row.eventKey);
	if (eventKey) return `eventKey:${eventKey}`;

	const naturalKey = IDENTITY_COLUMN_KEYS.filter((key) => key !== "eventKey")
		.map((key) => normalizeIdentityPart(row[key]))
		.filter(Boolean)
		.join("|");
	return naturalKey ? `natural:${naturalKey}` : `index:${index}`;
};

const buildRowQueueMap = (
	rows: EditableSheetRow[],
): Map<string, Array<{ row: EditableSheetRow; index: number }>> => {
	const rowsByKey = new Map<
		string,
		Array<{ row: EditableSheetRow; index: number }>
	>();
	rows.forEach((row, index) => {
		const key = buildRowIdentity(row, index);
		const queue = rowsByKey.get(key) ?? [];
		queue.push({ row, index });
		rowsByKey.set(key, queue);
	});
	return rowsByKey;
};

const getColumnLabel = (
	columnsByKey: Map<string, EditableSheetColumn>,
	key: string,
): string => columnsByKey.get(key)?.label ?? key;

const describeRow = (row: EditableSheetRow, fallbackIndex: number) => {
	const label =
		normalizeCellValue(row.title) ||
		normalizeCellValue(row.eventKey) ||
		`Untitled row ${fallbackIndex + 1}`;
	const subtitle = SUBTITLE_COLUMN_KEYS.map((key) =>
		normalizeCellValue(row[key]),
	)
		.filter(Boolean)
		.join(" · ");
	return { label, subtitle };
};

const getChangedCells = (
	columns: EditableSheetColumn[],
	currentRow: EditableSheetRow,
	revisionRow: EditableSheetRow,
): RevisionDiffCell[] =>
	columns
		.map((column) => {
			const currentValue = normalizeCellValue(currentRow[column.key]);
			const revisionValue = normalizeCellValue(revisionRow[column.key]);
			return currentValue === revisionValue
				? null
				: {
						key: column.key,
						label: column.label,
						currentValue,
						revisionValue,
					};
		})
		.filter((cell): cell is RevisionDiffCell => Boolean(cell));

export const buildRevisionDiff = ({
	columns,
	currentRows,
	revisionRows,
}: BuildRevisionDiffInput): RevisionDiff => {
	const columnsByKey = new Map(columns.map((column) => [column.key, column]));
	const remainingCurrentRows = buildRowQueueMap(currentRows);
	const added: RevisionRowDiff[] = [];
	const changed: RevisionRowDiff[] = [];

	revisionRows.forEach((revisionRow, revisionIndex) => {
		const key = buildRowIdentity(revisionRow, revisionIndex);
		const matches = remainingCurrentRows.get(key) ?? [];
		const currentMatch = matches.shift();
		if (matches.length === 0) {
			remainingCurrentRows.delete(key);
		} else {
			remainingCurrentRows.set(key, matches);
		}

		const description = describeRow(revisionRow, revisionIndex);
		if (!currentMatch) {
			added.push({
				key: `added:${key}:${revisionIndex}`,
				type: "added",
				label: description.label,
				subtitle: description.subtitle,
				changedCells: [],
			});
			return;
		}

		const changedCells = getChangedCells(
			columns,
			currentMatch.row,
			revisionRow,
		);
		if (changedCells.length === 0) return;

		changed.push({
			key: `changed:${key}:${revisionIndex}`,
			type: "changed",
			label: description.label,
			subtitle: description.subtitle,
			changedCells,
		});
	});

	const deleted = [...remainingCurrentRows.entries()].flatMap(([key, rows]) =>
		rows.map(({ row, index }) => {
			const description = describeRow(row, index);
			return {
				key: `deleted:${key}:${index}`,
				type: "deleted" as const,
				label: description.label,
				subtitle: description.subtitle,
				changedCells: IDENTITY_COLUMN_KEYS.map((columnKey) => ({
					key: columnKey,
					label: getColumnLabel(columnsByKey, columnKey),
					currentValue: normalizeCellValue(row[columnKey]),
					revisionValue: "",
				})).filter((cell) => cell.currentValue),
			};
		}),
	);

	return { added, deleted, changed };
};
