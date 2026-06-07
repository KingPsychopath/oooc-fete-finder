import { formatAdminDate } from "@/lib/ui/admin-date-format";
import { withAdminBasePath } from "../config";

const FILTER_GROUP_LABELS = {
	date_range: "Date Range",
	day_night: "Day / Night",
	arrondissement: "Arrondissement",
	genre: "Genre",
	nationality: "Nationality",
	venue_type: "Venue Type",
	venue_setting: "Venue Setting",
	oooc_pick: "OOOC Pick",
	price_range: "Price Range",
	age_range: "Age Range",
} as const;

export const RECENT_LIST_HELP_TEXT = {
	filters: "Tap a row to open this user's filter state on the home page.",
	searches: "Tap a search to open the home page with this query prefilled.",
	planActions:
		"Recent route planning, sharing, export, and shared-plan actions.",
	eventActions: "Tap an event action row to open this user's linked event.",
} as const;

export const buildAdminUserHref = (
	userId: string | null | undefined,
	email: string | null | undefined,
): string =>
	withAdminBasePath(
		`/admin/users/${encodeURIComponent(userId?.trim() || email?.trim() || "unknown")}`,
	);

export const formatAudienceContextValue = (
	value: string | null | undefined,
): string | null => {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	return trimmed
		.split(/[-_\s]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
};

const isDateRangeValue = (value: string): boolean =>
	value.includes(":") && value.split(":").length >= 2;

const formatDateRange = (value: string): string => {
	const [rawFrom, rawTo] = value.split(":", 2);
	const from = rawFrom.toLowerCase() !== "any" ? rawFrom : "";
	const to = rawTo.toLowerCase() !== "any" ? rawTo : "";
	if (!from && !to) return "Any";
	if (!from) return `Until ${formatAdminDate(to)}`;
	if (!to) return `From ${formatAdminDate(from)}`;
	return `${formatAdminDate(from)} - ${formatAdminDate(to)}`;
};

export const getAudienceFilterGroupLabel = (group: string): string =>
	(FILTER_GROUP_LABELS as Record<string, string>)[group] ??
	formatAudienceContextValue(group) ??
	group;

export const getAudienceFilterDisplayValue = (
	group: string,
	value: string,
): string => {
	if (group === "date_range" && isDateRangeValue(value)) {
		return formatDateRange(value);
	}
	return formatAudienceContextValue(value) ?? value;
};

export const buildAudienceFilterHref = (
	group: string,
	value: string,
): string | null => {
	const normalizedGroup = group.trim();
	const normalizedValue = value.trim();
	const normalizedValueLower = normalizedValue.toLowerCase();
	if (!normalizedGroup || !normalizedValue) return null;

	const params = new URLSearchParams();

	switch (normalizedGroup) {
		case "genre": {
			params.set("g", normalizedValue);
			break;
		}
		case "arrondissement": {
			params.set("arr", normalizedValue);
			break;
		}
		case "day_night": {
			if (normalizedValueLower === "day" || normalizedValueLower === "night") {
				params.set("dn", normalizedValueLower);
			}
			break;
		}
		case "nationality": {
			params.set("nat", normalizedValue.toUpperCase());
			break;
		}
		case "venue_type": {
			if (
				normalizedValueLower === "indoor" ||
				normalizedValueLower === "outdoor"
			) {
				params.set("vt", normalizedValueLower);
			}
			break;
		}
		case "venue_setting": {
			if (
				normalizedValueLower === "indoor" ||
				normalizedValueLower === "outdoor"
			) {
				params.set("in", normalizedValueLower);
			}
			break;
		}
		case "oooc_pick": {
			if (normalizedValueLower === "yes" || normalizedValueLower === "true") {
				params.set("pick", "1");
			}
			break;
		}
		case "price_range": {
			const [min, max] = normalizedValue.split(":");
			if (min && max) params.set("pr", `${min}:${max}`);
			break;
		}
		case "age_range": {
			const [min, max] = normalizedValue.split(":");
			if (min && max) params.set("ag", `${min}:${max}`);
			break;
		}
		case "date_range": {
			const [rawFrom, rawTo] = normalizedValue.split(":");
			const from = rawFrom?.trim();
			const to = rawTo?.trim();
			if (from && from !== "any") params.set("df", from);
			if (to && to !== "any") params.set("dt", to);
			break;
		}
		default:
			return null;
	}

	if (params.size === 0) return null;
	return `/?${params.toString()}`;
};

export const buildAudienceSearchHref = (query: string): string | null => {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) return null;
	const params = new URLSearchParams();
	params.set("q", normalizedQuery);
	return `/?${params.toString()}`;
};
