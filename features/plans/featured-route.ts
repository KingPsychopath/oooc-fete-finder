export const FEATURED_FETE_ROUTE = {
	active: true,
	slug: "fete-day-route",
	shareToken: "a8b66c2c34a6e82a27c705fe51222a12",
	label: "OOOC Fête route",
	headline: "Don’t know where to go?",
	summary:
		"Follow OOOC’s ready-made route through the day. Open it in maps, save a copy, or edit it.",
	homepageCta: "Follow the route",
	plansCta: "Start with this route",
	routeBadge: "OOOC recommended route",
	routeTitle: "OOOC Fête route",
	routeSummary:
		"Follow a ready-made Fête day route you can edit, save, or open in maps.",
	routeSaveCta: "Follow this route",
	routeSavedCta: "Route saved",
} as const;

export const getFeaturedFeteRouteHref = (): string =>
	`/plans/${FEATURED_FETE_ROUTE.shareToken}`;

export const isFeaturedFeteRouteShareToken = (
	shareToken: string | null | undefined,
): boolean =>
	FEATURED_FETE_ROUTE.active && shareToken === FEATURED_FETE_ROUTE.shareToken;
