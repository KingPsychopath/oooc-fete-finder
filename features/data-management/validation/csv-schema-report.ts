import type { EditableSheetRow } from "../csv/sheet-editor";
import { normalizeEventKey } from "../assembly/event-key";
import { parseSupportedNationalities } from "@/features/events/nationality-utils";

export type CsvSchemaIssueSeverity = "warning" | "error";

export interface CsvSchemaIssue {
	severity: CsvSchemaIssueSeverity;
	code:
		| "event_key_missing"
		| "event_key_invalid"
		| "event_key_duplicate"
		| "featured_legacy_value"
		| "ooc_picks_unexpected"
		| "nationality_unsupported"
		| "arrondissement_unexpected"
		| "indoor_outdoor_unexpected"
		| "date_missing_year";
	column: string;
	rowIndex: number;
	value: string;
	message: string;
}

export interface CsvSchemaReport {
	issues: CsvSchemaIssue[];
	hasBlockingIssues: boolean;
	blockingCount: number;
	warningCount: number;
}

const hasAnyRowValue = (row: EditableSheetRow): boolean => {
	return Object.values(row).some((value) => String(value ?? "").trim().length > 0);
};

const pushIssue = (
	issues: CsvSchemaIssue[],
	issue: CsvSchemaIssue,
): void => {
	issues.push(issue);
};

type EventKeyMode = "ignore" | "warn" | "error";

const keySeverity = (mode: EventKeyMode): CsvSchemaIssueSeverity | null => {
	if (mode === "warn") return "warning";
	if (mode === "error") return "error";
	return null;
};

const hasExplicitYear = (value: string): boolean => /\b(19|20)\d{2}\b/.test(value);

export const analyzeCsvSchemaRows = (
	rows: EditableSheetRow[],
	options?: {
		eventKeyMode?: EventKeyMode;
	},
): CsvSchemaReport => {
	const issues: CsvSchemaIssue[] = [];
	const eventKeyMode = options?.eventKeyMode ?? "warn";
	const eventKeySeverity = keySeverity(eventKeyMode);
	const seenEventKeys = new Map<string, number>();

	rows.forEach((row, index) => {
		if (!hasAnyRowValue(row)) return;
		const rowIndex = index + 1;
		const rawEventKey = String(row.eventKey ?? "").trim();
		const rawFeatured = String(row.featured ?? "").trim();
		const rawPicks = String(row.curated ?? "").trim();
		const rawHostCountry = String(row.hostCountry ?? "").trim();
		const rawAudienceCountry = String(row.audienceCountry ?? "").trim();
		const rawArrondissement = String(row.districtArea ?? "").trim();
		const rawVenue = String(row.setting ?? "").trim();
		const rawDate = String(row.date ?? "").trim();

		if (rawFeatured.length > 0) {
			pushIssue(issues, {
				severity: "error",
				code: "featured_legacy_value",
				column: "Featured",
				rowIndex,
				value: rawFeatured,
				message:
					'Legacy Featured values are not allowed. Use "Featured Events Manager".',
			});
		}

		if (eventKeySeverity) {
			if (!rawEventKey) {
				pushIssue(issues, {
					severity: eventKeySeverity,
					code: "event_key_missing",
					column: "Event Key",
					rowIndex,
					value: "",
					message:
						'Missing Event Key. Key will be auto-generated unless source is corrected.',
				});
			} else {
				const normalized = normalizeEventKey(rawEventKey);
				if (!normalized) {
					pushIssue(issues, {
						severity: eventKeySeverity,
						code: "event_key_invalid",
						column: "Event Key",
						rowIndex,
						value: rawEventKey,
						message:
							'Invalid Event Key format. Expected "evt_" + 12-20 lowercase letters/numbers.',
					});
				} else {
					const firstSeen = seenEventKeys.get(normalized);
					if (firstSeen !== undefined) {
						pushIssue(issues, {
							severity: eventKeySeverity,
							code: "event_key_duplicate",
							column: "Event Key",
							rowIndex,
							value: rawEventKey,
							message: `Duplicate Event Key (already used at row ${firstSeen}).`,
						});
					} else {
						seenEventKeys.set(normalized, rowIndex);
					}
				}
			}
		}

		if (rawPicks && rawPicks !== "🌟" && !rawPicks.toLowerCase().includes("pick")) {
			pushIssue(issues, {
				severity: "warning",
				code: "ooc_picks_unexpected",
				column: "Curated",
				rowIndex,
				value: rawPicks,
				message: 'Unexpected Curated value. Use "🌟" or leave blank.',
			});
		}

		if (rawHostCountry) {
			const parsed = parseSupportedNationalities(rawHostCountry);
			if (parsed.unsupportedTokens.length > 0) {
				pushIssue(issues, {
					severity: "warning",
					code: "nationality_unsupported",
					column: "Host Country",
					rowIndex,
					value: rawHostCountry,
					message: `Unsupported nationality tokens: ${parsed.unsupportedTokens.join(", ")}.`,
				});
			}
		}

		if (rawAudienceCountry) {
			const parsed = parseSupportedNationalities(rawAudienceCountry);
			if (parsed.unsupportedTokens.length > 0) {
				pushIssue(issues, {
					severity: "warning",
					code: "nationality_unsupported",
					column: "Audience Country",
					rowIndex,
					value: rawAudienceCountry,
					message: `Unsupported nationality tokens: ${parsed.unsupportedTokens.join(", ")}.`,
				});
			}
		}

		if (rawArrondissement && rawArrondissement !== "-") {
			const number = Number.parseInt(rawArrondissement, 10);
			const isValid =
				Number.isInteger(number) && number >= 1 && number <= 20;
			if (!isValid) {
				pushIssue(issues, {
					severity: "warning",
					code: "arrondissement_unexpected",
					column: "District/Area",
					rowIndex,
					value: rawArrondissement,
					message:
						'Unexpected district/area value. Use 1-20, "-" or leave blank.',
				});
			}
		}

		if (rawVenue) {
			const cleaned = rawVenue.toLowerCase();
			const looksIndoor = cleaned.includes("indoor");
			const looksOutdoor = cleaned.includes("outdoor");
			if (!looksIndoor && !looksOutdoor) {
				pushIssue(issues, {
					severity: "warning",
					code: "indoor_outdoor_unexpected",
					column: "Setting",
					rowIndex,
					value: rawVenue,
					message:
						'Unexpected setting value. Include "Indoor" and/or "Outdoor".',
				});
			}
		}

		if (rawDate && !hasExplicitYear(rawDate)) {
			pushIssue(issues, {
				severity: "warning",
				code: "date_missing_year",
				column: "Date",
				rowIndex,
				value: rawDate,
				message:
					"Date has no explicit year; import will infer year from context/reference date.",
			});
		}
	});

	const blockingCount = issues.filter(
		(issue) => issue.severity === "error",
	).length;
	const warningCount = issues.length - blockingCount;

	return {
		issues,
		hasBlockingIssues: blockingCount > 0,
		blockingCount,
		warningCount,
	};
};
