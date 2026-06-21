"use server";

import { recordAdminActivity } from "@/features/admin/activity/record";
import { validateAdminAccessFromServerContext } from "@/features/auth/admin-validation";
import { OFFICIAL_FETE_PLAN } from "@/features/plans/official-plan-config";
import type {
	PublishedPlanAdminSummary,
	PublishedPlanAlias,
	PublishedPlanResolution,
	SharedPlanSearchResult,
} from "@/features/plans/published-plan-types";
import { getPublishedPlanRepository } from "@/lib/platform/postgres/published-plan-repository";

type PublishedPlanAdminResponse = {
	success: boolean;
	items?: PublishedPlanAdminSummary[];
	error?: string;
	message?: string;
};

type SharedPlanSearchResponse = {
	success: boolean;
	results?: SharedPlanSearchResult[];
	error?: string;
};

type PublishedPlanMutationResponse = PublishedPlanAdminResponse & {
	published?: PublishedPlanResolution;
	alias?: PublishedPlanAlias;
};

const getRepository = () => {
	const repository = getPublishedPlanRepository();
	if (!repository) {
		throw new Error("Published plan store is unavailable");
	}
	return repository;
};

const listItems = async (): Promise<PublishedPlanAdminSummary[]> =>
	getRepository().listAdminSummaries();

export async function getAdminPublishedPlans(
	keyOrToken?: string,
): Promise<PublishedPlanAdminResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		return { success: true, items: await listItems() };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to load published plans",
		};
	}
}

export async function searchSharedPlansForPublishing(
	keyOrToken: string | undefined,
	query: string,
): Promise<SharedPlanSearchResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		return {
			success: true,
			results: await getRepository().searchSharedPlans({ query, limit: 25 }),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to search shared plans",
		};
	}
}

export async function publishSharedPlanAsOfficial(
	keyOrToken: string | undefined,
	input: {
		shareToken: string;
		slug?: string;
		title?: string;
		description?: string;
	},
): Promise<PublishedPlanMutationResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const slug = input.slug?.trim() || OFFICIAL_FETE_PLAN.slug;
		const published = await getRepository().publishFromSharedPlan({
			shareToken: input.shareToken,
			slug,
			title: input.title,
			description: input.description,
			publishedBy: "admin",
		});
		await recordAdminActivity({
			action: "plans.published_plan.published",
			category: "content",
			targetType: "published_plan",
			targetId: published.plan.id,
			targetLabel: published.version.title,
			summary: `Published /plans/${published.alias.pathSlug} version ${published.version.versionNumber}`,
			metadata: {
				alias: published.alias.pathSlug,
				versionNumber: published.version.versionNumber,
				stopCount: published.version.stops.length,
				sourceShareToken: input.shareToken,
			},
			href: `/admin/content#published-plans`,
		});
		return {
			success: true,
			published,
			items: await listItems(),
			message: `Published /plans/${published.alias.pathSlug}`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unable to publish plan",
		};
	}
}

export async function republishOfficialPlanFromSource(
	keyOrToken: string | undefined,
	publishedPlanId: string,
): Promise<PublishedPlanMutationResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const published = await getRepository().republishFromSource({
			publishedPlanId,
			publishedBy: "admin",
		});
		await recordAdminActivity({
			action: "plans.published_plan.republished",
			category: "content",
			targetType: "published_plan",
			targetId: published.plan.id,
			targetLabel: published.version.title,
			summary: `Republished /plans/${published.alias.pathSlug} version ${published.version.versionNumber}`,
			metadata: {
				alias: published.alias.pathSlug,
				versionNumber: published.version.versionNumber,
				stopCount: published.version.stops.length,
			},
			href: "/admin/content#published-plans",
		});
		return {
			success: true,
			published,
			items: await listItems(),
			message: `Published version ${published.version.versionNumber}`,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to republish plan",
		};
	}
}

export async function createPublishedPlanArchiveAlias(
	keyOrToken: string | undefined,
	input: {
		sourceSlug?: string;
		archiveSlug?: string;
	},
): Promise<PublishedPlanMutationResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const alias = await getRepository().createArchiveAlias({
			sourceSlug: input.sourceSlug?.trim() || OFFICIAL_FETE_PLAN.slug,
			archiveSlug: input.archiveSlug?.trim() || OFFICIAL_FETE_PLAN.archiveSlug,
			updatedBy: "admin",
		});
		await recordAdminActivity({
			action: "plans.published_plan.archive_alias.created",
			category: "content",
			targetType: "published_plan_alias",
			targetId: alias.pathSlug,
			targetLabel: `/plans/${alias.pathSlug}`,
			summary: `Created archive alias /plans/${alias.pathSlug}`,
			metadata: {
				alias: alias.pathSlug,
				targetVersionId: alias.targetVersionId,
			},
			href: "/admin/content#published-plans",
		});
		return {
			success: true,
			alias,
			items: await listItems(),
			message: `Created /plans/${alias.pathSlug}`,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unable to create archive alias",
		};
	}
}

export async function redirectPublishedPlanAlias(
	keyOrToken: string | undefined,
	input: { slug: string; redirectToSlug: string },
): Promise<PublishedPlanMutationResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const alias = await getRepository().redirectAlias(input);
		await recordAdminActivity({
			action: "plans.published_plan.alias.redirected",
			category: "content",
			targetType: "published_plan_alias",
			targetId: alias.pathSlug,
			targetLabel: `/plans/${alias.pathSlug}`,
			summary: `Redirected /plans/${alias.pathSlug} to /plans/${alias.redirectToSlug}`,
			metadata: {
				alias: alias.pathSlug,
				redirectToSlug: alias.redirectToSlug,
			},
			href: "/admin/content#published-plans",
		});
		return {
			success: true,
			alias,
			items: await listItems(),
			message: `Redirected /plans/${alias.pathSlug}`,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unable to redirect alias",
		};
	}
}

export async function markPublishedPlanAliasGone(
	keyOrToken: string | undefined,
	slug: string,
): Promise<PublishedPlanMutationResponse> {
	if (!(await validateAdminAccessFromServerContext(keyOrToken ?? null))) {
		return { success: false, error: "Unauthorized access" };
	}
	try {
		const alias = await getRepository().markAliasGone(slug);
		await recordAdminActivity({
			action: "plans.published_plan.alias.gone",
			category: "content",
			targetType: "published_plan_alias",
			targetId: alias.pathSlug,
			targetLabel: `/plans/${alias.pathSlug}`,
			summary: `Marked /plans/${alias.pathSlug} as gone`,
			metadata: { alias: alias.pathSlug },
			href: "/admin/content#published-plans",
		});
		return {
			success: true,
			alias,
			items: await listItems(),
			message: `Marked /plans/${alias.pathSlug} as gone`,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unable to update alias",
		};
	}
}
