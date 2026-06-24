export const OFFICIAL_FETE_PLAN = {
	active: true,
	seasonStatus: "wrapped",
	slug: "fete",
	archiveSlug: "fete-2026",
	shortcutPath: "/route",
	sourceShareToken: "a8b66c2c34a6e82a27c705fe51222a12",
	label: "2026 Fête route archive",
	headline: "Browse the 2026 OOOC route",
	summary:
		"The handmade Fête route is archived for reference. Open it in maps, save a copy, or adapt it for a future night.",
	homepageCta: "View route archive",
	plansCta: "Use archived route",
	routeBadge: "Archived by OOOC",
	routeTitle: "OOOC’s 2026 Fête route",
	routeSummary: "A saved Fête 2026 route you can copy, edit, or open in maps.",
	crossSellHeadline: "Want the 2026 OOOC route?",
	crossSellSummary: "Use the archived Fête route as a starting point.",
	routeSaveCta: "Save this route",
	routeSavedCta: "Route saved",
} as const;

export const getOfficialFetePlanHref = (): string =>
	`/plans/${OFFICIAL_FETE_PLAN.slug}`;

export const getOfficialFetePlanArchiveHref = (): string =>
	`/plans/${OFFICIAL_FETE_PLAN.archiveSlug}`;

export const isDeprecatedOfficialFeteSourceToken = (
	value: string | null | undefined,
): boolean =>
	OFFICIAL_FETE_PLAN.active && value === OFFICIAL_FETE_PLAN.sourceShareToken;
