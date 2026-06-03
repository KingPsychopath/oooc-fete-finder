"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { InfoPopover } from "@/components/ui/info-popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getTourProgressLabel } from "@/features/events/engagement/tour-analytics";
import {
	formatAdminDate,
	formatAdminDateTime,
} from "@/lib/ui/admin-date-format";
import {
	CheckSquare,
	Copy,
	Download,
	Eye,
	FileUp,
	RefreshCw,
	Search,
	Trash2,
	Upload,
} from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import type {
	CollectedUserProfile,
	CollectedUserProfileResponse,
	EmailRecord,
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
} from "../types";

type UserProfileLookup = {
	email?: string;
	userId?: string;
};

type EmailSortMode =
	| "newest"
	| "oldest"
	| "email"
	| "name"
	| "consented"
	| "likely-test"
	| "activity"
	| "last-active"
	| "first-sign-in"
	| "searches"
	| "filters";

type EmailFilterMode = "all" | "consented" | "no-consent" | "likely-test";

type EmailActivityFilterMode =
	| "all"
	| "has-activity"
	| "no-activity"
	| "recently-active"
	| "searches"
	| "filters"
	| "plan-actions"
	| "event-actions"
	| "genre-prefs"
	| "returned-no-activity"
	| "has-context"
	| "missing-context";

const ACTIVITY_SEGMENTS: Array<{
	label: string;
	value: EmailActivityFilterMode;
	sortMode: EmailSortMode;
}> = [
	{ label: "Any linked activity", value: "has-activity", sortMode: "activity" },
	{
		label: "Active last 7d",
		value: "recently-active",
		sortMode: "last-active",
	},
	{ label: "Searchers", value: "searches", sortMode: "searches" },
	{ label: "Filter users", value: "filters", sortMode: "filters" },
	{ label: "Plan users", value: "plan-actions", sortMode: "activity" },
	{ label: "Event action users", value: "event-actions", sortMode: "activity" },
	{
		label: "Genre preference users",
		value: "genre-prefs",
		sortMode: "activity",
	},
	{
		label: "Seen after last action",
		value: "returned-no-activity",
		sortMode: "newest",
	},
	{ label: "Context available", value: "has-context", sortMode: "last-active" },
	{ label: "Context missing", value: "missing-context", sortMode: "newest" },
];

type EmailMutationResult = {
	success: boolean;
	error?: string;
	deletedCount?: number;
	importedCount?: number;
	updatedCount?: number;
	skippedCount?: number;
};

type EmailCollectionCardProps = {
	emails: EmailRecord[];
	store: UserCollectionStoreSummary | null;
	analytics: UserCollectionAnalytics | null;
	onCopyEmails: (emails: EmailRecord[]) => void;
	onExportCSV: () => void;
	onRefresh: () => Promise<void>;
	onDeleteEmails: (emails: string[]) => Promise<EmailMutationResult>;
	onImportEmails: (rawInput: string) => Promise<EmailMutationResult>;
	onGetUserProfile: (
		lookup: UserProfileLookup,
	) => Promise<CollectedUserProfileResponse>;
};

const TEST_EMAIL_HINTS = [
	"test",
	"example",
	"demo",
	"fake",
	"dummy",
	"localhost",
	"invalid",
];
const RETURNED_AFTER_ACTION_THRESHOLD_MS = 30 * 60 * 1000;
const REGISTRATION_WINDOW_24_HOURS_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_WINDOW_7_DAYS_MS = 7 * REGISTRATION_WINDOW_24_HOURS_MS;
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
const RECENT_LIST_HELP_TEXT = {
	filters: "Tap a row to open this user's filter state on the home page.",
	searches: "Tap a search to open the home page with this query prefilled.",
	planActions:
		"Recent route planning, sharing, export, and shared-plan actions.",
	eventActions: "Tap an event action row to open this user's linked event.",
} as const;

const isDateRangeValue = (value: string): boolean =>
	value.includes(":") && value.split(":").length >= 2;

const formatDateRange = (value: string): string => {
	const [rawFrom, rawTo] = value.split(":", 2);
	const from = rawFrom.toLowerCase() !== "any" ? rawFrom : "";
	const to = rawTo.toLowerCase() !== "any" ? rawTo : "";
	if (!from && !to) return "Any";
	if (!from) return `Until ${formatAdminDate(to)}`;
	if (!to) return `From ${formatAdminDate(from)}`;
	return `${formatAdminDate(from)} — ${formatAdminDate(to)}`;
};

const getFilterGroupLabel = (group: string): string =>
	(FILTER_GROUP_LABELS as Record<string, string>)[group] ??
	formatContextValue(group) ??
	group;

const getFilterDisplayValue = (group: string, value: string): string => {
	if (group === "date_range" && isDateRangeValue(value)) {
		return formatDateRange(value);
	}
	return formatContextValue(value) ?? value;
};

const getParsedTime = (value?: string): number => {
	const parsed = Date.parse(value ?? "");
	return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const buildFilterEventHref = (group: string, value: string): string | null => {
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

const buildSearchEventHref = (query: string): string | null => {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) return null;
	const params = new URLSearchParams();
	params.set("q", normalizedQuery);
	return `/?${params.toString()}`;
};

const isLikelyTestEmail = (email: string): boolean => {
	const normalized = email.toLowerCase();
	return TEST_EMAIL_HINTS.some((hint) => normalized.includes(hint));
};

const compareStrings = (left: string, right: string): number =>
	left.localeCompare(right, undefined, { sensitivity: "base" });

const getTime = (value: string | null | undefined): number => {
	if (!value) return 0;
	const parsed = new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : 0;
};

const getActivityCount = (user: EmailRecord): number =>
	user.linkedSignalCount ?? 0;

const hasReturnedWithoutNewActivity = (user: EmailRecord): boolean => {
	const capturedAt = getTime(user.timestamp);
	const lastActiveAt = getTime(user.lastSignalAt);
	return (
		capturedAt > 0 &&
		lastActiveAt > 0 &&
		capturedAt - lastActiveAt >= RETURNED_AFTER_ACTION_THRESHOLD_MS
	);
};

const sortEmails = (emails: EmailRecord[], sortMode: EmailSortMode) => {
	return [...emails].sort((left, right) => {
		switch (sortMode) {
			case "first-sign-in":
				return (
					getTime(right.firstSignInAt ?? right.timestamp) -
					getTime(left.firstSignInAt ?? left.timestamp)
				);
			case "oldest":
				return (
					new Date(left.timestamp).getTime() -
					new Date(right.timestamp).getTime()
				);
			case "email":
				return compareStrings(left.email, right.email);
			case "name":
				return compareStrings(
					`${left.firstName} ${left.lastName}`.trim() || left.email,
					`${right.firstName} ${right.lastName}`.trim() || right.email,
				);
			case "consented":
				return Number(right.consent) - Number(left.consent);
			case "likely-test":
				return (
					Number(isLikelyTestEmail(right.email)) -
					Number(isLikelyTestEmail(left.email))
				);
			case "activity":
				return getActivityCount(right) - getActivityCount(left);
			case "last-active":
				return getTime(right.lastSignalAt) - getTime(left.lastSignalAt);
			case "searches":
				return (right.searchSignalCount ?? 0) - (left.searchSignalCount ?? 0);
			case "filters":
				return (right.filterSignalCount ?? 0) - (left.filterSignalCount ?? 0);
			default:
				return (
					new Date(right.timestamp).getTime() -
					new Date(left.timestamp).getTime()
				);
		}
	});
};

const formatContextValue = (
	value: string | null | undefined,
): string | null => {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	return trimmed
		.split(/[-_\s]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
};

const getUserContextItems = (user: EmailRecord) =>
	[
		["Device", user.deviceClass],
		["Platform", user.platform],
		["Browser", user.browserFamily],
		["Timezone", user.timezone],
		["Locale", user.locale],
	]
		.map(([label, value]) => ({
			label,
			value: formatContextValue(value),
		}))
		.filter((item): item is { label: string; value: string } =>
			Boolean(item.value),
		);

const hasUsefulContext = (user: EmailRecord): boolean =>
	getUserContextItems(user).length > 0;

const matchesActivityFilter = (
	user: EmailRecord,
	filterMode: EmailActivityFilterMode,
): boolean => {
	const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	switch (filterMode) {
		case "has-activity":
			return getActivityCount(user) > 0;
		case "no-activity":
			return getActivityCount(user) === 0;
		case "recently-active":
			return getTime(user.lastSignalAt) >= sevenDaysAgo;
		case "searches":
			return (user.searchSignalCount ?? 0) > 0;
		case "filters":
			return (user.filterSignalCount ?? 0) > 0;
		case "plan-actions":
			return (user.planActionSignalCount ?? 0) > 0;
		case "event-actions":
			return (user.eventActionSignalCount ?? 0) > 0;
		case "genre-prefs":
			return (user.genrePreferenceSignalCount ?? 0) > 0;
		case "returned-no-activity":
			return hasReturnedWithoutNewActivity(user);
		case "has-context":
			return hasUsefulContext(user);
		case "missing-context":
			return !hasUsefulContext(user);
		default:
			return true;
	}
};

const toCsvCell = (value: string | number | boolean | null | undefined) => {
	const text = String(value ?? "");
	return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const hasTermsAcceptance = (user: EmailRecord): boolean =>
	Boolean(user.consent && user.termsAcceptedAt && user.termsVersion);

const hasPrivacyAcceptance = (user: EmailRecord): boolean =>
	Boolean(user.consent && user.privacyAcceptedAt && user.privacyVersion);

const exportUserCsv = (records: EmailRecord[], filenamePrefix: string) => {
	if (records.length === 0 || typeof document === "undefined") return;
	const header = [
		"First Name",
		"Last Name",
		"Email",
		"First Sign-in At",
		"Last Sign-in At",
		"Last Active At",
		"Terms Accepted",
		"Terms Version",
		"Terms Accepted At",
		"Privacy Accepted",
		"Privacy Version",
		"Privacy Accepted At",
		"Marketing Consent",
		"Event Update Consent",
		"Collection Origin",
		"Linked Activity",
		"Search Activity",
		"Filter Activity",
		"Plan Action Activity",
		"Event Action Activity",
		"Genre Preference Activity",
		"Device",
		"Platform",
		"Browser",
		"Timezone",
		"Locale",
	];
	const rows = records.map((user) => [
		user.firstName,
		user.lastName,
		user.email,
		user.firstSignInAt ?? "",
		user.timestamp,
		user.lastSignalAt ?? "",
		hasTermsAcceptance(user),
		user.termsVersion ?? "",
		user.termsAcceptedAt ?? "",
		hasPrivacyAcceptance(user),
		user.privacyVersion ?? "",
		user.privacyAcceptedAt ?? "",
		Boolean(user.marketingConsent),
		Boolean(user.eventUpdateConsent),
		user.source,
		user.linkedSignalCount ?? 0,
		user.searchSignalCount ?? 0,
		user.filterSignalCount ?? 0,
		user.planActionSignalCount ?? 0,
		user.eventActionSignalCount ?? 0,
		user.genrePreferenceSignalCount ?? 0,
		user.deviceClass ?? "",
		user.platform ?? "",
		user.browserFamily ?? "",
		user.timezone ?? "",
		user.locale ?? "",
	]);
	const csv = [header, ...rows]
		.map((row) => row.map((cell) => toCsvCell(cell)).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${filenamePrefix}-${new Date().toISOString().split("T")[0]}.csv`;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	URL.revokeObjectURL(url);
};

const getProfileSignalCount = (profile: CollectedUserProfile): number =>
	Math.max(
		profile.user.linkedSignalCount ?? 0,
		profile.genrePreferences.length +
			profile.recentTourInteractions.length +
			profile.recentSearches.length +
			profile.recentFilters.length +
			profile.recentPlanActions.length +
			profile.recentEventActions.length,
	);

const getLastActiveAt = (profile: CollectedUserProfile): string | null => {
	const dates = [
		profile.user.lastSignalAt,
		...profile.genrePreferences.map((item) => item.lastSeenAt),
		...profile.recentTourInteractions.map((item) => item.recordedAt),
		...profile.recentSearches.map((item) => item.recordedAt),
		...profile.recentFilters.map((item) => item.recordedAt),
		...profile.recentPlanActions.map((item) => item.recordedAt),
		...profile.recentEventActions.map((item) => item.recordedAt),
	].filter((value): value is string => Boolean(value));
	return dates.sort((left, right) => right.localeCompare(left))[0] ?? null;
};

const getBehaviorRead = (profile: CollectedUserProfile): string => {
	const searches = Math.max(
		profile.user.searchSignalCount ?? 0,
		profile.recentSearches.length,
	);
	const filters = Math.max(
		profile.user.filterSignalCount ?? 0,
		profile.recentFilters.length,
	);
	const eventActions = Math.max(
		profile.user.eventActionSignalCount ?? 0,
		profile.recentEventActions.length,
	);
	const planActions = Math.max(
		profile.user.planActionSignalCount ?? 0,
		profile.recentPlanActions.length,
	);
	const genres = Math.max(
		profile.user.genrePreferenceSignalCount ?? 0,
		profile.genrePreferences.length,
	);
	if (planActions >= Math.max(searches + filters + eventActions, 1)) {
		return "Plan-led browsing";
	}
	if (eventActions >= Math.max(searches + filters, 1)) {
		return "Event-led browsing";
	}
	if (filters > searches) return "Filter-led browsing";
	if (searches > 0) return "Search-led browsing";
	if (genres > 0) return "Taste-led browsing";
	return "Signup only";
};

const getSignalMetricItems = (profile: CollectedUserProfile) => [
	{
		label: "Linked activity",
		value: getProfileSignalCount(profile),
	},
	{
		label: "Searches",
		value: Math.max(
			profile.user.searchSignalCount ?? 0,
			profile.recentSearches.length,
		),
	},
	{
		label: "Filters",
		value: Math.max(
			profile.user.filterSignalCount ?? 0,
			profile.recentFilters.length,
		),
	},
	{
		label: "Plan actions",
		value: Math.max(
			profile.user.planActionSignalCount ?? 0,
			profile.recentPlanActions.length,
		),
	},
	{
		label: "Event actions",
		value: Math.max(
			profile.user.eventActionSignalCount ?? 0,
			profile.recentEventActions.length,
		),
	},
	{
		label: "Genre prefs",
		value: Math.max(
			profile.user.genrePreferenceSignalCount ?? 0,
			profile.genrePreferences.length,
		),
	},
];

const getKnownUserDataItems = (profile: CollectedUserProfile) => [
	{ label: "User ID", value: profile.user.userId ?? "Unknown" },
	{ label: "Email", value: profile.user.email },
	{
		label: "Name",
		value:
			profile.user.firstName || profile.user.lastName
				? `${profile.user.firstName} ${profile.user.lastName}`.trim()
				: "Unknown",
	},
	{
		label: "Terms",
		value: hasTermsAcceptance(profile.user)
			? `Accepted ${profile.user.termsVersion ?? ""}`.trim()
			: "Not accepted",
	},
	{
		label: "Terms accepted at",
		value: profile.user.termsAcceptedAt
			? formatAdminDateTime(profile.user.termsAcceptedAt)
			: "Not recorded",
	},
	{
		label: "Privacy",
		value: hasPrivacyAcceptance(profile.user)
			? `Accepted ${profile.user.privacyVersion ?? ""}`.trim()
			: "Not accepted",
	},
	{
		label: "Privacy accepted at",
		value: profile.user.privacyAcceptedAt
			? formatAdminDateTime(profile.user.privacyAcceptedAt)
			: "Not recorded",
	},
	{
		label: "Marketing updates",
		value: profile.user.marketingConsent ? "Opted in" : "Not opted in",
	},
	{
		label: "Event updates",
		value: profile.user.eventUpdateConsent ? "Opted in" : "Not opted in",
	},
	{ label: "Collection origin", value: profile.user.source || "Unknown" },
	{
		label: "Last sign-in",
		value: formatAdminDateTime(profile.user.timestamp),
	},
	{
		label: "First sign-in",
		value: profile.user.firstSignInAt
			? formatAdminDateTime(profile.user.firstSignInAt)
			: "Not yet recorded",
	},
	{
		label: "Latest linked activity",
		value: getLastActiveAt(profile)
			? formatAdminDateTime(getLastActiveAt(profile) ?? "")
			: "No linked activity",
	},
	{
		label: "Tour progress",
		value: getTourProgressLabel(profile.recentTourInteractions),
	},
	{
		label: "Device",
		value: formatContextValue(profile.user.deviceClass) ?? "Unknown",
	},
	{
		label: "Platform",
		value: formatContextValue(profile.user.platform) ?? "Unknown",
	},
	{
		label: "Browser",
		value: formatContextValue(profile.user.browserFamily) ?? "Unknown",
	},
	{ label: "Timezone", value: profile.user.timezone ?? "Unknown" },
	{ label: "Locale", value: profile.user.locale ?? "Unknown" },
];

export const EmailCollectionCard = ({
	emails,
	store,
	analytics,
	onCopyEmails,
	onExportCSV,
	onRefresh,
	onDeleteEmails,
	onImportEmails,
	onGetUserProfile,
}: EmailCollectionCardProps) => {
	const [query, setQuery] = useState("");
	const [sortMode, setSortMode] = useState<EmailSortMode>("last-active");
	const [filterMode, setFilterMode] = useState<EmailFilterMode>("all");
	const [activityFilterMode, setActivityFilterMode] =
		useState<EmailActivityFilterMode>("all");
	const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
	const [importText, setImportText] = useState("");
	const [statusMessage, setStatusMessage] = useState("");
	const [isBusy, setIsBusy] = useState(false);
	const [profileEmail, setProfileEmail] = useState<string | null>(null);
	const [profile, setProfile] = useState<CollectedUserProfile | null>(null);
	const [profileStatus, setProfileStatus] = useState("");
	const [isProfileLoading, setIsProfileLoading] = useState(false);
	const [profileOverrides, setProfileOverrides] = useState<
		Record<string, Partial<EmailRecord>>
	>({});
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const profileRequestIdRef = useRef(0);
	const mergedEmails = useMemo(
		() =>
			emails.map((user) => ({
				...user,
				...(profileOverrides[user.email] ?? {}),
			})),
		[emails, profileOverrides],
	);
	const likelyTestCount = mergedEmails.filter((user) =>
		isLikelyTestEmail(user.email),
	).length;
	const totalSubmissions = analytics?.totalSubmissions ?? emails.length;
	const submissionsLast24Hours = analytics?.submissionsLast24Hours ?? 0;
	const submissionsLast7Days = analytics?.submissionsLast7Days ?? 0;
	const { newUsersLast24Hours, newUsersLast7Days } = useMemo(() => {
		const now = Date.now();
		const cutoff24h = now - REGISTRATION_WINDOW_24_HOURS_MS;
		const cutoff7d = now - REGISTRATION_WINDOW_7_DAYS_MS;
		let usersLast24h = 0;
		let usersLast7d = 0;

		for (const user of mergedEmails) {
			const parsed = getParsedTime(user.firstSignInAt ?? user.timestamp);
			if (Number.isNaN(parsed)) continue;
			if (parsed >= cutoff24h) usersLast24h++;
			if (parsed >= cutoff7d) usersLast7d++;
		}

		return {
			newUsersLast24Hours: usersLast24h,
			newUsersLast7Days: usersLast7d,
		};
	}, [mergedEmails]);
	const activitySegmentCounts = useMemo(
		() =>
			new Map(
				ACTIVITY_SEGMENTS.map((segment) => [
					segment.value,
					mergedEmails.filter((user) =>
						matchesActivityFilter(user, segment.value),
					).length,
				]),
			),
		[mergedEmails],
	);

	const filteredEmails = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		const filtered = mergedEmails.filter((user) => {
			if (filterMode === "consented" && !user.consent) return false;
			if (filterMode === "no-consent" && user.consent) return false;
			if (filterMode === "likely-test" && !isLikelyTestEmail(user.email)) {
				return false;
			}
			if (!matchesActivityFilter(user, activityFilterMode)) return false;
			if (!normalizedQuery) return true;
			return [
				user.firstName,
				user.lastName,
				user.email,
				user.source,
				user.timestamp,
				user.deviceClass,
				user.platform,
				user.browserFamily,
				user.timezone,
				user.locale,
			]
				.join(" ")
				.toLowerCase()
				.includes(normalizedQuery);
		});
		return sortEmails(filtered, sortMode);
	}, [activityFilterMode, filterMode, mergedEmails, query, sortMode]);

	const visibleEmailSet = useMemo(
		() => new Set(filteredEmails.map((user) => user.email)),
		[filteredEmails],
	);
	const visibleSelectedCount = selectedEmails.filter((email) =>
		visibleEmailSet.has(email),
	).length;
	const allVisibleSelected =
		filteredEmails.length > 0 && visibleSelectedCount === filteredEmails.length;
	const selectedEmailSet = useMemo(
		() => new Set(selectedEmails),
		[selectedEmails],
	);
	const selectedRecords = useMemo(
		() => mergedEmails.filter((user) => selectedEmailSet.has(user.email)),
		[mergedEmails, selectedEmailSet],
	);

	const handleRefresh = async () => {
		await onRefresh();
		setProfileOverrides({});
	};

	const handleToggleEmail = (email: string) => {
		setSelectedEmails((current) =>
			current.includes(email)
				? current.filter((selectedEmail) => selectedEmail !== email)
				: [...current, email],
		);
	};

	const handleToggleFiltered = () => {
		setSelectedEmails((current) => {
			if (allVisibleSelected) {
				return current.filter((email) => !visibleEmailSet.has(email));
			}
			return Array.from(
				new Set([...current, ...filteredEmails.map((user) => user.email)]),
			);
		});
	};

	const handleCopyRecords = (records: EmailRecord[], label: string) => {
		if (records.length === 0) return;
		onCopyEmails(records);
		setStatusMessage(`Copied ${records.length} ${label} email(s).`);
	};

	const handleDeleteSelected = async () => {
		if (selectedEmails.length === 0) return;
		const confirmed = window.confirm(
			`Delete ${selectedEmails.length} collected email record(s)? This cannot be undone.`,
		);
		if (!confirmed) return;

		setIsBusy(true);
		setStatusMessage("Deleting selected emails...");
		const result = await onDeleteEmails(selectedEmails);
		if (result.success) {
			setStatusMessage(`Deleted ${result.deletedCount ?? 0} email record(s).`);
			setSelectedEmails([]);
			await handleRefresh();
		} else {
			setStatusMessage(result.error || "Delete failed.");
		}
		setIsBusy(false);
	};

	const handleImport = async (rawInput: string, sourceLabel: string) => {
		if (!rawInput.trim()) return;

		setIsBusy(true);
		setStatusMessage(`Importing ${sourceLabel} email records...`);
		const result = await onImportEmails(rawInput);
		if (result.success) {
			setStatusMessage(
				`Appended ${result.importedCount ?? 0}, updated ${
					result.updatedCount ?? 0
				}, skipped ${result.skippedCount ?? 0} from ${sourceLabel}.`,
			);
			setImportText("");
			await handleRefresh();
		} else {
			setStatusMessage(result.error || "Import failed.");
		}
		setIsBusy(false);
	};

	const handleCsvFileSelected = async (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		try {
			const text = await file.text();
			await handleImport(text, file.name);
		} catch (error) {
			setStatusMessage(
				`Failed to read CSV file: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	};

	const handleOpenProfile = async (user: EmailRecord) => {
		const requestId = profileRequestIdRef.current + 1;
		profileRequestIdRef.current = requestId;
		setProfileEmail(user.email);
		setProfile(null);
		setProfileStatus("");
		setIsProfileLoading(true);
		try {
			const result = await onGetUserProfile({
				email: user.email,
				userId: user.userId,
			});
			if (profileRequestIdRef.current !== requestId) return;
			if (result.success && result.profile) {
				const loadedProfile = result.profile;
				setProfile(loadedProfile);
				setProfileOverrides((current) => ({
					...current,
					[loadedProfile.user.email]: {
						linkedSignalCount: loadedProfile.user.linkedSignalCount,
						searchSignalCount: loadedProfile.user.searchSignalCount,
						filterSignalCount: loadedProfile.user.filterSignalCount,
						planActionSignalCount: loadedProfile.user.planActionSignalCount,
						eventActionSignalCount: loadedProfile.user.eventActionSignalCount,
						genrePreferenceSignalCount:
							loadedProfile.user.genrePreferenceSignalCount,
						lastSignalAt: loadedProfile.user.lastSignalAt,
						deviceClass: loadedProfile.user.deviceClass,
						platform: loadedProfile.user.platform,
						browserFamily: loadedProfile.user.browserFamily,
						timezone: loadedProfile.user.timezone,
						locale: loadedProfile.user.locale,
					},
				}));
			} else {
				setProfileStatus(result.error || "Profile could not be loaded.");
			}
		} catch (error) {
			if (profileRequestIdRef.current !== requestId) return;
			setProfileStatus(
				error instanceof Error ? error.message : "Profile could not be loaded.",
			);
		} finally {
			if (profileRequestIdRef.current === requestId) {
				setIsProfileLoading(false);
			}
		}
	};

	const handleCloseProfile = () => {
		profileRequestIdRef.current += 1;
		setProfileEmail(null);
		setProfile(null);
		setProfileStatus("");
		setIsProfileLoading(false);
	};

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Collected User Emails</CardTitle>
						<CardDescription>
							Auth modal submissions are stored in your managed user store and
							can be copied, exported, imported, or tidied here.
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() => void handleRefresh()}
							variant="outline"
							size="sm"
							disabled={isBusy}
						>
							<RefreshCw className="size-4" />
							Refresh
						</Button>
						<Button onClick={onExportCSV} size="sm">
							<Download className="size-4" />
							Export CSV
						</Button>
					</div>
				</div>
				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							New Registrations
						</p>
						<p className="mt-1 text-sm font-medium tabular-nums">
							{newUsersLast24Hours} / {newUsersLast7Days}
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">24h / 7d</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Unique Users
						</p>
						<p className="mt-1 text-sm font-medium">{emails.length}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Total Seen Events
						</p>
						<p className="mt-1 text-sm font-medium">
							{analytics?.totalSubmissions ?? emails.length}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Likely Tests
						</p>
						<p className="mt-1 text-sm font-medium">{likelyTestCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Recently Seen
						</p>
						<p className="mt-1 text-sm font-medium tabular-nums">
							{submissionsLast24Hours} / {submissionsLast7Days}
						</p>
						<p className="mt-0.5 text-[11px] text-muted-foreground">24h / 7d</p>
					</div>
				</div>
				<div className="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
					<p className="break-all">
						Store path: {store?.location || "Unavailable"}
					</p>
					<p className="mt-1">
						Last updated:{" "}
						{store?.lastUpdatedAt
							? formatAdminDateTime(store.lastUpdatedAt)
							: "Never"}
					</p>
				</div>
				<div className="grid gap-2 lg:grid-cols-2">
					<div className="space-y-2 rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Seen Pace
						</p>
						<div className="space-y-1.5">
							{[
								{ label: "24h", value: submissionsLast24Hours },
								{ label: "7d", value: submissionsLast7Days },
							].map((item) => (
								<div key={item.label} className="space-y-1">
									<div className="flex justify-between gap-2 text-xs">
										<span>{item.label}</span>
										<span className="tabular-nums">{item.value}</span>
									</div>
									<div className="h-1.5 rounded-full bg-muted/70">
										<div
											className="h-1.5 rounded-full bg-amber-600/80"
											style={{
												width: `${Math.max(
													item.value > 0 ? 5 : 0,
													totalSubmissions > 0
														? (item.value / totalSubmissions) * 100
														: 0,
												)}%`,
											}}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
					<div className="space-y-2 rounded-md border bg-background/60 px-3 py-2">
						<div className="flex items-center">
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Most Common User Context
							</p>
							<InfoPopover aria-label="Explain user context" side="top">
								These are the most common values across collected users with
								captured context, not averages. Each user's latest signed-in
								activity can update their device, platform, browser, timezone,
								and locale.
							</InfoPopover>
						</div>
						<div className="space-y-1 text-xs text-muted-foreground">
							<p className="flex justify-between gap-2">
								<span>Top Device</span>
								<span className="truncate text-foreground">
									{analytics?.topDeviceClasses?.[0]?.label ?? "Unknown"}
								</span>
							</p>
							<p className="flex justify-between gap-2">
								<span>Top Platform</span>
								<span className="truncate text-foreground">
									{analytics?.topPlatforms?.[0]?.label ?? "Unknown"}
								</span>
							</p>
							<p className="flex justify-between gap-2">
								<span>Top Timezone</span>
								<span className="truncate text-foreground">
									{analytics?.topTimezones?.[0]?.label ?? "Unknown"}
								</span>
							</p>
							<p className="flex justify-between gap-2">
								<span>Top Locale</span>
								<span className="truncate text-foreground">
									{analytics?.topLocales?.[0]?.label ?? "Unknown"}
								</span>
							</p>
							<p className="flex justify-between gap-2">
								<span>Linked activity</span>
								<span className="tabular-nums text-foreground">
									{analytics?.linkedBehaviorUsers ?? 0}/{emails.length}
								</span>
							</p>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_9rem_11rem_9rem]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search name, email, origin, device, timezone..."
							className="pl-8"
						/>
					</div>
					<select
						value={filterMode}
						onChange={(event) =>
							setFilterMode(event.target.value as EmailFilterMode)
						}
						className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="all">All records</option>
						<option value="consented">Consented</option>
						<option value="no-consent">No consent</option>
						<option value="likely-test">Likely tests</option>
					</select>
					<select
						value={activityFilterMode}
						onChange={(event) =>
							setActivityFilterMode(
								event.target.value as EmailActivityFilterMode,
							)
						}
						className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="all">All segments</option>
						<option value="has-activity">Any linked activity</option>
						<option value="no-activity">No linked activity</option>
						<option value="recently-active">Active last 7d</option>
						<option value="searches">Searched</option>
						<option value="filters">Used filters</option>
						<option value="plan-actions">Used plans</option>
						<option value="event-actions">Opened/saved events</option>
						<option value="genre-prefs">Genre prefs</option>
						<option value="returned-no-activity">Seen after last action</option>
						<option value="has-context">Context available</option>
						<option value="missing-context">Context missing</option>
					</select>
					<select
						value={sortMode}
						onChange={(event) =>
							setSortMode(event.target.value as EmailSortMode)
						}
						className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="last-active">Last active</option>
						<option value="newest">Recently seen</option>
						<option value="oldest">Oldest seen</option>
						<option value="email">Email A-Z</option>
						<option value="name">Name A-Z</option>
						<option value="consented">Consent first</option>
						<option value="likely-test">Tests first</option>
						<option value="first-sign-in">First sign in</option>
						<option value="activity">Most activity</option>
						<option value="searches">Most searches</option>
						<option value="filters">Most filters</option>
					</select>
				</div>

				<div className="rounded-md border bg-background/60 p-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<div className="flex items-center">
								<p className="text-sm font-medium">User segments</p>
								<InfoPopover aria-label="Explain user segments" side="top">
									These buttons filter users by linked behaviour, later return
									visits, and captured context. Click an active segment again to
									clear it.
								</InfoPopover>
							</div>
							<p className="mt-1 text-xs text-muted-foreground">
								Use these to spot behaviour patterns, quiet return visits, and
								users with usable device context.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setActivityFilterMode("all");
								setFilterMode("all");
								setSortMode("last-active");
								setQuery("");
							}}
						>
							Reset
						</Button>
					</div>
					<div className="mt-3 flex flex-wrap gap-2">
						{ACTIVITY_SEGMENTS.map((segment) => (
							<Button
								key={segment.value}
								type="button"
								variant={
									activityFilterMode === segment.value ? "default" : "outline"
								}
								size="sm"
								onClick={() => {
									if (activityFilterMode === segment.value) {
										setActivityFilterMode("all");
										setSortMode("last-active");
										return;
									}
									setActivityFilterMode(segment.value);
									setSortMode(segment.sortMode);
								}}
							>
								{segment.label}
								<span className="tabular-nums">
									{activitySegmentCounts.get(segment.value) ?? 0}
								</span>
							</Button>
						))}
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 px-3 py-2">
					<p className="text-xs text-muted-foreground">
						Showing {filteredEmails.length} of {emails.length}; selected{" "}
						{selectedEmails.length}.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleToggleFiltered}
							disabled={filteredEmails.length === 0}
						>
							<CheckSquare className="size-4" />
							{allVisibleSelected ? "Clear Filtered" : "Select Filtered"}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => handleCopyRecords(selectedRecords, "selected")}
							disabled={selectedRecords.length === 0}
						>
							<Copy className="size-4" />
							Copy Selected
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => handleCopyRecords(filteredEmails, "filtered")}
							disabled={filteredEmails.length === 0}
						>
							<Copy className="size-4" />
							Copy Filtered
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								exportUserCsv(filteredEmails, "fete-finder-filtered-users")
							}
							disabled={filteredEmails.length === 0}
						>
							<Download className="size-4" />
							Export Filtered
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={() => void handleDeleteSelected()}
							disabled={isBusy || selectedEmails.length === 0}
						>
							<Trash2 className="size-4" />
							Delete Selected
						</Button>
					</div>
				</div>

				<div className="rounded-md border bg-background/60 p-3">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div>
							<p className="text-sm font-medium">Append or update emails</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Imports never wipe the list. New emails are added; matching
								emails are updated by email address.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={isBusy}
						>
							<FileUp className="size-4" />
							Upload CSV
						</Button>
					</div>
					<div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
						<Textarea
							value={importText}
							onChange={(event) => setImportText(event.target.value)}
							placeholder="Paste CSV with an Email column, or one email per line"
							className="min-h-20"
						/>
						<Button
							type="button"
							onClick={() => void handleImport(importText, "pasted")}
							disabled={isBusy || !importText.trim()}
							className="self-start"
						>
							<Upload className="size-4" />
							Import Paste
						</Button>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept=".csv,text/csv"
						onChange={(event) => void handleCsvFileSelected(event)}
						className="hidden"
					/>
				</div>

				{statusMessage && (
					<div className="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
						{statusMessage}
					</div>
				)}

				{filteredEmails.length === 0 ? (
					<div className="rounded-md border bg-background/60 px-3 py-10 text-center text-sm text-muted-foreground">
						No matching users.
					</div>
				) : (
					<div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
						{filteredEmails.map((user) => {
							const isSelected = selectedEmails.includes(user.email);
							const isTest = isLikelyTestEmail(user.email);
							return (
								<div
									key={`${user.email}-${user.timestamp}`}
									className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border bg-background/60 p-3 transition-colors hover:bg-muted/40 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
								>
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => handleToggleEmail(user.email)}
										className="mt-1 size-4 rounded border-input"
										aria-label={`Select ${user.email}`}
									/>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-start justify-between gap-2">
											<span className="min-w-0">
												<span className="block truncate text-sm font-medium">
													{user.firstName || user.lastName
														? `${user.firstName} ${user.lastName}`.trim()
														: "No name"}
												</span>
												<span className="block truncate text-xs text-muted-foreground">
													{user.email}
												</span>
											</span>
											<span className="flex flex-wrap gap-1.5">
												{isTest && <Badge variant="outline">Likely test</Badge>}
												<Badge variant="outline">
													{user.linkedSignalCount ?? 0} activity
												</Badge>
												<Badge
													variant={
														hasTermsAcceptance(user) ? "default" : "destructive"
													}
												>
													{hasTermsAcceptance(user) ? "Terms" : "No terms"}
												</Badge>
												<Badge
													variant={
														hasPrivacyAcceptance(user)
															? "outline"
															: "destructive"
													}
												>
													{hasPrivacyAcceptance(user)
														? "Privacy"
														: "No privacy"}
												</Badge>
												{user.marketingConsent && (
													<Badge variant="outline">Marketing opt-in</Badge>
												)}
												{user.eventUpdateConsent && !user.marketingConsent && (
													<Badge variant="outline">Event updates</Badge>
												)}
												{!user.marketingConsent && !user.eventUpdateConsent && (
													<Badge variant="secondary">No marketing</Badge>
												)}
											</span>
										</span>
										<span className="mt-2 flex flex-wrap gap-1.5">
											{(user.searchSignalCount ?? 0) > 0 && (
												<Badge variant="outline">
													Searches: {user.searchSignalCount}
												</Badge>
											)}
											{(user.filterSignalCount ?? 0) > 0 && (
												<Badge variant="outline">
													Filters: {user.filterSignalCount}
												</Badge>
											)}
											{(user.planActionSignalCount ?? 0) > 0 && (
												<Badge variant="outline">
													Plans: {user.planActionSignalCount}
												</Badge>
											)}
											{(user.eventActionSignalCount ?? 0) > 0 && (
												<Badge variant="outline">
													Events: {user.eventActionSignalCount}
												</Badge>
											)}
											{(user.genrePreferenceSignalCount ?? 0) > 0 && (
												<Badge variant="outline">
													Genres: {user.genrePreferenceSignalCount}
												</Badge>
											)}
											{hasReturnedWithoutNewActivity(user) && (
												<Badge variant="outline">Seen after last action</Badge>
											)}
										</span>
										{getUserContextItems(user).length > 0 && (
											<span className="mt-2 flex flex-wrap gap-1.5">
												{getUserContextItems(user).map((item) => (
													<Badge key={item.label} variant="outline">
														{item.label}: {item.value}
													</Badge>
												))}
											</span>
										)}
										<span className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
											{user.firstSignInAt && (
												<span>
													First sign in{" "}
													{formatAdminDateTime(user.firstSignInAt)}
												</span>
											)}
											<span>
												Last sign in {formatAdminDateTime(user.timestamp)}
											</span>
											{user.lastSignalAt && (
												<span>
													Latest linked activity{" "}
													{formatAdminDateTime(user.lastSignalAt)}
												</span>
											)}
										</span>
									</span>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void handleOpenProfile(user)}
										className="col-start-2 w-fit shrink-0 justify-self-start sm:col-start-auto sm:justify-self-end"
									>
										<Eye className="size-4" />
										View
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
			<Dialog
				open={Boolean(profileEmail)}
				onOpenChange={(open) => {
					if (!open) {
						handleCloseProfile();
					}
				}}
			>
				<DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>User Profile</DialogTitle>
						<DialogDescription>
							First-party context and recent behavior linked to this signed-in
							user.
						</DialogDescription>
					</DialogHeader>
					{isProfileLoading ? (
						<div className="rounded-md border bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
							Loading user activity...
						</div>
					) : profile ? (
						<div className="space-y-4">
							<div className="rounded-md border bg-background/60 p-3">
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">
											{profile.user.firstName || profile.user.lastName
												? `${profile.user.firstName} ${profile.user.lastName}`.trim()
												: "No name"}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{profile.user.email}
										</p>
									</div>
								</div>
								<div className="mt-3 grid gap-2 sm:grid-cols-3">
									<p className="rounded-md border bg-background/60 px-2.5 py-2 text-xs">
										<span className="flex items-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
											Behavior Type
											<InfoPopover
												aria-label="Explain behavior type"
												side="top"
											>
												The dominant pattern across linked searches, filters,
												event actions, and genre preferences.
											</InfoPopover>
										</span>
										<span className="mt-1 block font-medium">
											{getBehaviorRead(profile)}
										</span>
										<span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
											Dominant linked activity pattern.
										</span>
									</p>
									<p className="rounded-md border bg-background/60 px-2.5 py-2 text-xs">
										<span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
											Latest Linked Activity
										</span>
										<span className="mt-1 block font-medium">
											{getLastActiveAt(profile)
												? formatAdminDateTime(getLastActiveAt(profile) ?? "")
												: "No activity yet"}
										</span>
									</p>
									<p className="rounded-md border bg-background/60 px-2.5 py-2 text-xs">
										<span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
											Top Genre
										</span>
										<span className="mt-1 block font-medium">
											{formatContextValue(profile.genrePreferences[0]?.genre) ??
												"Unknown"}
										</span>
										<span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
											Highest score, then most recent.
										</span>
									</p>
								</div>
								<div className="mt-3 grid gap-2 sm:grid-cols-5">
									{getSignalMetricItems(profile).map((item) => (
										<p
											key={item.label}
											className="rounded-md border bg-background/60 px-2.5 py-2 text-xs"
										>
											<span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
												{item.label}
											</span>
											<span className="mt-1 block font-medium tabular-nums">
												{item.value}
											</span>
										</p>
									))}
								</div>
								<div className="mt-3 grid gap-2 sm:grid-cols-2">
									{getKnownUserDataItems(profile).map((item) => (
										<p
											key={item.label}
											className="flex justify-between gap-2 rounded-md border bg-background/60 px-2.5 py-2 text-xs"
										>
											<span className="text-muted-foreground">
												{item.label}
											</span>
											<span className="truncate text-foreground">
												{item.value}
											</span>
										</p>
									))}
								</div>
							</div>

							<div className="grid gap-3 lg:grid-cols-2">
								<div className="rounded-md border bg-background/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Genre Preferences
									</p>
									<div className="mt-2 space-y-1.5">
										{profile.genrePreferences.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												No genre activity.
											</p>
										) : (
											profile.genrePreferences.map((item) => (
												<p
													key={item.genre}
													className="flex justify-between gap-2 text-xs"
												>
													<span>{formatContextValue(item.genre)}</span>
													<span className="tabular-nums text-muted-foreground">
														score {item.score}
													</span>
												</p>
											))
										)}
									</div>
								</div>
								<div className="rounded-md border bg-background/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Recent Searches
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{RECENT_LIST_HELP_TEXT.searches}
									</p>
									<div className="mt-2 space-y-1.5">
										{profile.recentSearches.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												No searches linked.
											</p>
										) : (
											profile.recentSearches.map((item) => (
												<p
													key={`${item.query}-${item.recordedAt}`}
													className="flex justify-between gap-2 text-xs"
												>
													<span className="truncate">
														{(() => {
															const searchHref = buildSearchEventHref(
																item.query,
															);
															return searchHref == null ? (
																item.query
															) : (
																<Link
																	href={searchHref}
																	target="_blank"
																	rel="noreferrer"
																	className="inline-flex items-center underline decoration-dotted underline-offset-2 hover:decoration-solid"
																>
																	{item.query}
																</Link>
															);
														})()}
													</span>
													<span className="shrink-0 text-muted-foreground">
														{formatAdminDateTime(item.recordedAt)}
													</span>
												</p>
											))
										)}
									</div>
								</div>
								<div className="rounded-md border bg-background/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Recent Filters
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{RECENT_LIST_HELP_TEXT.filters}
									</p>
									<div className="mt-2 space-y-1.5">
										{profile.recentFilters.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												No filters linked.
											</p>
										) : (
											profile.recentFilters.map((item) => {
												const filterHref = buildFilterEventHref(
													item.filterGroup,
													item.filterValue,
												);
												const groupLabel = getFilterGroupLabel(
													item.filterGroup,
												);
												const valueLabel = getFilterDisplayValue(
													item.filterGroup,
													item.filterValue,
												);
												return (
													<p
														key={`${item.filterGroup}-${item.filterValue}-${item.recordedAt}`}
														className="flex justify-between gap-2 text-xs"
													>
														<span
															className="min-w-0 flex-1 whitespace-normal break-words"
															title={`${groupLabel}: ${valueLabel}`}
														>
															{groupLabel}:{" "}
															{filterHref == null ? (
																valueLabel
															) : (
																<Link
																	href={filterHref}
																	target="_blank"
																	rel="noreferrer"
																	className="inline-flex items-center underline decoration-dotted underline-offset-2 hover:decoration-solid"
																>
																	{valueLabel}
																</Link>
															)}
														</span>
														<span className="shrink-0 text-muted-foreground">
															{formatAdminDateTime(item.recordedAt)}
														</span>
													</p>
												);
											})
										)}
									</div>
								</div>
								<div className="rounded-md border bg-background/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Recent Plan Actions
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{RECENT_LIST_HELP_TEXT.planActions}
									</p>
									<div className="mt-2 space-y-1.5">
										{profile.recentPlanActions.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												No plan actions linked.
											</p>
										) : (
											profile.recentPlanActions.map((item) => (
												<p
													key={`${item.surface}-${item.action}-${item.recordedAt}`}
													className="flex justify-between gap-2 text-xs"
												>
													<span className="min-w-0 flex-1 truncate">
														{formatContextValue(item.surface)} ·{" "}
														{formatContextValue(item.action)}
														{item.detail ? (
															<span className="text-muted-foreground">
																{" "}
																({item.detail})
															</span>
														) : null}
													</span>
													<span className="shrink-0 text-muted-foreground">
														{formatAdminDateTime(item.recordedAt)}
													</span>
												</p>
											))
										)}
									</div>
								</div>
								<div className="rounded-md border bg-background/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
										Recent Event Actions
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{RECENT_LIST_HELP_TEXT.eventActions}
									</p>
									<div className="mt-2 space-y-1.5">
										{profile.recentEventActions.length === 0 ? (
											<p className="text-xs text-muted-foreground">
												No event actions linked.
											</p>
										) : (
											profile.recentEventActions.slice(0, 8).map((item) => (
												<p
													key={`${item.eventKey}-${item.actionType}-${item.recordedAt}`}
													className="flex justify-between gap-2 text-xs"
												>
													<span className="truncate">
														{formatContextValue(item.actionType)} ·{" "}
														{item.eventHref ? (
															<Link
																href={item.eventHref}
																className="underline-offset-4 hover:underline"
															>
																{item.eventName ?? item.eventKey}
															</Link>
														) : (
															(item.eventName ?? item.eventKey)
														)}
													</span>
													<span className="shrink-0 text-muted-foreground">
														{formatAdminDateTime(item.recordedAt)}
													</span>
												</p>
											))
										)}
									</div>
								</div>
							</div>
						</div>
					) : (
						<div className="rounded-md border bg-background/60 px-3 py-8 text-center text-sm text-muted-foreground">
							{profileStatus || "No profile data available."}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</Card>
	);
};
