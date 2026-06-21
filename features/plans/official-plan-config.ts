export const OFFICIAL_FETE_PLAN = {
	active: true,
	slug: "fete",
	archiveSlug: "fete-2026",
	shortcutPath: "/route",
	sourceShareToken: "a8b66c2c34a6e82a27c705fe51222a12",
	label: "Handmade Fête route",
	headline: "Need a ready-made route for today?",
	summary:
		"Follow our handmade route for Fête. Open it in maps, save a copy, or edit it.",
	homepageCta: "Follow our route",
	plansCta: "Start with this route",
	routeBadge: "Handmade by OOOC",
	routeTitle: "OOOC’s route for Fête",
	routeSummary:
		"A handmade Fête day route you can edit, save, or open in maps.",
	crossSellHeadline: "Need a ready-made route for today?",
	crossSellSummary: "Follow our handmade route for Fête.",
	routeSaveCta: "Follow this route",
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
