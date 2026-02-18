/**
 * Date Format Warning System
 *
 * Centralized system for collecting and managing warnings about date format issues
 * encountered during CSV processing. Helps with data quality monitoring.
 */

export type DateFormatWarning = {
	originalValue: string;
	eventName?: string;
	columnType: "featured" | "date" | "startTime" | "endTime";
	warningType:
		| "ambiguous"
		| "future_featured"
		| "inferred_year"
		| "invalid"
		| "unparseable";
	potentialFormats: {
		us: { date: string; description: string };
		uk: { date: string; description: string };
		iso: string;
	};
	detectedFormat: string;
	recommendedAction: string;
	rowIndex: number;
};

/**
 * Global warnings collector
 * In production, this might be replaced with a proper logging system
 */
let dateFormatWarnings: DateFormatWarning[] = [];

/**
 * Warning System API
 */
export const WarningSystem = {
	/**
	 * Clear all collected warnings
	 */
	clearDateFormatWarnings: (): void => {
		dateFormatWarnings = [];
	},

	/**
	 * Get all collected warnings
	 */
	getDateFormatWarnings: (): DateFormatWarning[] => {
		return [...dateFormatWarnings];
	},

	/**
	 * Add a new warning to the collection
	 */
	addDateFormatWarning: (warning: DateFormatWarning): void => {
		dateFormatWarnings.push(warning);
	},

	/**
	 * Get warnings by type
	 */
	getWarningsByType: (
		warningType: DateFormatWarning["warningType"],
	): DateFormatWarning[] => {
		return dateFormatWarnings.filter(
			(warning) => warning.warningType === warningType,
		);
	},

	/**
	 * Get warnings by column type
	 */
	getWarningsByColumn: (
		columnType: DateFormatWarning["columnType"],
	): DateFormatWarning[] => {
		return dateFormatWarnings.filter(
			(warning) => warning.columnType === columnType,
		);
	},

	/**
	 * Check if there are any warnings
	 */
	hasWarnings: (): boolean => {
		return dateFormatWarnings.length > 0;
	},

	/**
	 * Get warning count
	 */
	getWarningCount: (): number => {
		return dateFormatWarnings.length;
	},

	/**
	 * Generate summary report of all warnings
	 */
	generateSummaryReport: (): {
		totalWarnings: number;
		byType: Record<DateFormatWarning["warningType"], number>;
		byColumn: Record<DateFormatWarning["columnType"], number>;
		criticalIssues: DateFormatWarning[];
	} => {
		const byType: Record<DateFormatWarning["warningType"], number> = {
			ambiguous: 0,
			future_featured: 0,
			inferred_year: 0,
			invalid: 0,
			unparseable: 0,
		};

		const byColumn: Record<DateFormatWarning["columnType"], number> = {
			featured: 0,
			date: 0,
			startTime: 0,
			endTime: 0,
		};

		const criticalIssues: DateFormatWarning[] = [];

		for (const warning of dateFormatWarnings) {
			byType[warning.warningType]++;
			byColumn[warning.columnType]++;

			// Consider 'invalid' and 'unparseable' as critical
			if (
				warning.warningType === "invalid" ||
				warning.warningType === "unparseable"
			) {
				criticalIssues.push(warning);
			}
		}

		return {
			totalWarnings: dateFormatWarnings.length,
			byType,
			byColumn,
			criticalIssues,
		};
	},
};

/**
 * Helper functions for creating warnings
 */
export const WarningHelpers = {
	/**
	 * Create a featured date warning
	 */
	createFeaturedDateWarning: (
		originalValue: string,
		eventName: string,
		rowIndex: number,
		warningType: DateFormatWarning["warningType"] = "ambiguous",
	): DateFormatWarning => ({
		originalValue,
		eventName,
		columnType: "featured",
		warningType,
		potentialFormats: {
			us: { date: "", description: "MM/DD/YYYY format" },
			uk: { date: "", description: "DD/MM/YYYY format" },
			iso: "",
		},
		detectedFormat: "",
		recommendedAction: "Verify date format and update CSV",
		rowIndex,
	}),

	/**
	 * Create a general date warning
	 */
	createDateWarning: (
		originalValue: string,
		columnType: DateFormatWarning["columnType"],
		eventName: string,
		rowIndex: number,
		warningType: DateFormatWarning["warningType"] = "ambiguous",
	): DateFormatWarning => ({
		originalValue,
		eventName,
		columnType,
		warningType,
		potentialFormats: {
			us: { date: "", description: "MM/DD/YYYY format" },
			uk: { date: "", description: "DD/MM/YYYY format" },
			iso: "",
		},
		detectedFormat: "",
		recommendedAction: "Verify date format and update CSV",
		rowIndex,
	}),
};
