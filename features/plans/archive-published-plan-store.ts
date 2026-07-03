import "server-only";

import archivePublishedPlansData from "@/data/archive-published-plans.json";
import type {
	PublishedPlanAlias,
	PublishedPlanAliasResolution,
	PublishedPlanResolution,
} from "@/features/plans/published-plan-types";

type ArchivePublishedPlansData = {
	version?: number;
	exportedAt?: string | null;
	aliases?: PublishedPlanAlias[];
	resolutions?: PublishedPlanResolution[];
};

const RESERVED_PLAN_ALIASES = new Set([
	"new",
	"api",
	"admin",
	"route",
	"routes",
	"share",
	"shared",
]);

const normalizeSlug = (value: string): string => {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	if (!slug || RESERVED_PLAN_ALIASES.has(slug)) return "";
	return slug;
};

const getArchiveData = (): Required<
	Pick<ArchivePublishedPlansData, "aliases" | "resolutions">
> => {
	const data = archivePublishedPlansData as ArchivePublishedPlansData;
	return {
		aliases: Array.isArray(data.aliases) ? data.aliases : [],
		resolutions: Array.isArray(data.resolutions) ? data.resolutions : [],
	};
};

export const resolveArchivePublishedPlanAlias = (
	id: string,
): PublishedPlanAliasResolution => {
	const slug = normalizeSlug(id);
	if (!slug) return { kind: "not_found" };

	const { aliases, resolutions } = getArchiveData();
	const alias = aliases.find((candidate) => candidate.pathSlug === slug);
	if (!alias) return { kind: "not_found" };
	if (alias.status === "redirect" && alias.redirectToSlug) {
		return {
			kind: "redirect",
			value: { alias, redirectToSlug: alias.redirectToSlug },
		};
	}
	if (alias.status === "gone") {
		return { kind: "gone", value: { alias } };
	}
	if (!alias.publishedPlanId || !alias.targetVersionId) {
		return { kind: "gone", value: { alias } };
	}

	const resolution = resolutions.find(
		(candidate) =>
			candidate.alias.pathSlug === slug ||
			(candidate.alias.publishedPlanId === alias.publishedPlanId &&
				candidate.alias.targetVersionId === alias.targetVersionId),
	);
	if (!resolution) return { kind: "gone", value: { alias } };
	return { kind: "published", value: resolution };
};
