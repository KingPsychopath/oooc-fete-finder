export type NormalizedRowDataRecord = Record<string, string>;

export const normalizeEventSheetRowData = (
	value: unknown,
): NormalizedRowDataRecord => {
	let source: unknown = value;
	for (let depth = 0; depth < 3 && typeof source === "string"; depth += 1) {
		try {
			source = JSON.parse(source);
		} catch {
			break;
		}
	}

	if (!source || typeof source !== "object") {
		return {};
	}

	const entries = Object.entries(source).map(([key, raw]) => [
		key,
		raw == null ? "" : String(raw),
	]);
	const normalized = Object.fromEntries(entries);
	if (!normalized.area && normalized.districtArea) {
		normalized.area = normalized.districtArea;
	}
	delete normalized.districtArea;
	return normalized;
};
