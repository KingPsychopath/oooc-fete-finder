export type AdminModuleKey =
	| "hub"
	| "operations"
	| "content"
	| "placements"
	| "insights";

export interface AdminSectionConfig {
	id: string;
	label: string;
	description: string;
	path: string;
	moduleKey: Exclude<AdminModuleKey, "hub">;
	keywords?: string[];
}

export interface AdminRouteConfig {
	key: AdminModuleKey;
	label: string;
	description: string;
	path: string;
	sections: AdminSectionConfig[];
}

export interface AdminCommandItem {
	id: string;
	label: string;
	hint: string;
	path: string;
	keywords: string[];
	moduleKey: AdminModuleKey;
}

const ADMIN_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

export const withAdminBasePath = (path: string): string => {
	if (!path.startsWith("/")) {
		return path;
	}
	return `${ADMIN_BASE_PATH}${path}`;
};

export const stripAdminBasePath = (pathname: string): string => {
	if (!pathname) return "/";
	if (!ADMIN_BASE_PATH) return pathname;
	if (!pathname.startsWith(ADMIN_BASE_PATH)) return pathname;

	const stripped = pathname.slice(ADMIN_BASE_PATH.length);
	return stripped.length > 0 ? stripped : "/";
};

export const ADMIN_ROUTES: AdminRouteConfig[] = [
	{
		key: "hub",
		label: "Admin Overview",
		description: "Entry point with status badges and quick links to each admin area.",
		path: "/admin",
		sections: [],
	},
	{
		key: "operations",
		label: "System Operations",
		description:
			"Runtime health, store controls, session controls, and recovery tools.",
		path: "/admin/operations",
		sections: [
			{
				id: "events-data-status",
				label: "Runtime Data Status",
				description: "Live runtime source and revalidation controls.",
				path: "/admin/operations#events-data-status",
				moduleKey: "operations",
				keywords: ["runtime", "status", "revalidate"],
			},
			{
				id: "live-site-snapshot",
				label: "Live Runtime Snapshot",
				description: "Inspect runtime payload and source checks.",
				path: "/admin/operations#live-site-snapshot",
				moduleKey: "operations",
				keywords: ["snapshot", "live", "source", "runtime"],
			},
			{
				id: "data-store-controls",
				label: "Event Store Controls",
				description: "Import, backups, restore, and CSV controls.",
				path: "/admin/operations#data-store-controls",
				moduleKey: "operations",
				keywords: ["store", "backup", "restore", "csv"],
			},
			{
				id: "admin-session",
				label: "Admin Session & Tokens",
				description: "Session status and token revocation tools.",
				path: "/admin/operations#admin-session",
				moduleKey: "operations",
				keywords: ["session", "token", "revoke", "auth"],
			},
			{
				id: "factory-reset",
				label: "Factory Reset (Danger Zone)",
				description: "Danger zone reset controls.",
				path: "/admin/operations#factory-reset",
				moduleKey: "operations",
				keywords: ["reset", "danger", "hard reset"],
			},
		],
	},
	{
		key: "content",
		label: "Content & Submissions",
		description:
			"Event sheet editing, submission moderation, and sliding banner settings.",
		path: "/admin/content",
		sections: [
			{
				id: "event-sheet-editor",
				label: "Event Sheet Editor",
				description: "Edit event data rows and custom columns.",
				path: "/admin/content#event-sheet-editor",
				moduleKey: "content",
				keywords: ["sheet", "editor", "rows", "events"],
			},
			{
				id: "event-submissions",
				label: "Event Submissions",
				description: "Review and moderate submitted events.",
				path: "/admin/content#event-submissions",
				moduleKey: "content",
				keywords: ["submissions", "moderation", "review"],
			},
			{
				id: "sliding-banner",
				label: "Homepage Sliding Banner",
				description: "Configure rotating homepage banner messages.",
				path: "/admin/content#sliding-banner",
				moduleKey: "content",
				keywords: ["banner", "messages", "site settings"],
			},
		],
	},
	{
		key: "placements",
		label: "Paid Placements",
		description:
			"Paid order fulfillment and Spotlight/Promoted placement scheduling.",
		path: "/admin/placements",
		sections: [
			{
				id: "paid-orders-inbox",
				label: "Paid Orders Queue",
				description: "Fulfill paid placement requests.",
				path: "/admin/placements#paid-orders-inbox",
				moduleKey: "placements",
				keywords: ["orders", "paid", "fulfillment", "stripe"],
			},
			{
				id: "featured-events-manager",
				label: "Spotlight & Promoted Scheduler",
				description: "Schedule and manage Spotlight and Promoted queues.",
				path: "/admin/placements#featured-events-manager",
				moduleKey: "placements",
				keywords: ["featured", "promoted", "queue", "schedule"],
			},
		],
	},
	{
		key: "insights",
		label: "Analytics & Audience",
		description:
			"Engagement analytics and collected user export.",
		path: "/admin/insights",
		sections: [
			{
				id: "event-engagement-stats",
				label: "Event Engagement Stats",
				description: "Behavior and ROI analytics.",
				path: "/admin/insights#event-engagement-stats",
				moduleKey: "insights",
				keywords: ["analytics", "engagement", "discovery", "roi"],
			},
			{
				id: "collected-users",
				label: "Collected User Emails",
				description: "Export and inspect collected user records.",
				path: "/admin/insights#collected-users",
				moduleKey: "insights",
				keywords: ["users", "emails", "export", "csv"],
			},
		],
	},
];

export const isAdminRouteActive = (
	route: AdminRouteConfig,
	pathname: string,
): boolean => {
	if (route.path === "/admin") {
		return pathname === "/admin";
	}

	return pathname === route.path || pathname.startsWith(`${route.path}/`);
};

export const getAdminRouteByPath = (
	pathname: string,
): AdminRouteConfig | undefined => {
	for (const route of ADMIN_ROUTES) {
		if (isAdminRouteActive(route, pathname)) {
			return route;
		}
	}
	return ADMIN_ROUTES[0];
};

const toRouteCommand = (route: AdminRouteConfig): AdminCommandItem => ({
	id: `route:${route.key}`,
	label: route.label,
	hint: route.description,
	path: route.path,
	moduleKey: route.key,
	keywords: [route.key, route.label, ...route.description.toLowerCase().split(" ")],
});

const toSectionCommand = (section: AdminSectionConfig): AdminCommandItem => ({
	id: `section:${section.id}`,
	label: section.label,
	hint: section.description,
	path: section.path,
	moduleKey: section.moduleKey,
	keywords: [section.moduleKey, section.id, ...(section.keywords ?? [])],
});

export const ADMIN_COMMAND_ITEMS: AdminCommandItem[] = ADMIN_ROUTES.flatMap(
	(route) => [toRouteCommand(route), ...route.sections.map(toSectionCommand)],
);
