"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OFFICIAL_FETE_PLAN } from "@/features/plans/official-plan-config";
import {
	createPublishedPlanArchiveAlias,
	getAdminPublishedPlans,
	markPublishedPlanAliasGone,
	publishSharedPlanAsOfficial,
	redirectPublishedPlanAlias,
	republishOfficialPlanFromSource,
	searchSharedPlansForPublishing,
} from "@/features/plans/published-plan-actions";
import type {
	PublishedPlanAdminSummary,
	PublishedPlanSourceStatus,
	SharedPlanSearchResult,
} from "@/features/plans/published-plan-types";
import { cn } from "@/lib/utils";
import { Archive, ArrowUpRight, RefreshCw, Route, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type PublishedPlansPayload = Awaited<ReturnType<typeof getAdminPublishedPlans>>;

type PublishedPlansCardProps = {
	initialPayload?: PublishedPlansPayload;
};

const SOURCE_STATUS_LABEL: Record<PublishedPlanSourceStatus, string> = {
	current: "current",
	changed: "changed",
	deleted: "deleted",
	unshared: "unshared",
	unknown: "unknown",
	none: "none",
};

const sourceStatusVariant = (
	status: PublishedPlanSourceStatus,
): "secondary" | "destructive" | "outline" =>
	status === "current" || status === "none"
		? "secondary"
		: status === "unknown"
			? "outline"
			: "destructive";

const formatDateTime = (isoDate: string | null | undefined): string => {
	if (!isoDate) return "Unknown";
	const time = new Date(isoDate).getTime();
	if (!Number.isFinite(time)) return "Unknown";
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Europe/London",
	}).format(time);
};

export function PublishedPlansCard({
	initialPayload,
}: PublishedPlansCardProps) {
	const [items, setItems] = useState<PublishedPlanAdminSummary[]>(
		initialPayload?.success ? (initialPayload.items ?? []) : [],
	);
	const [shareToken, setShareToken] = useState<string>(
		OFFICIAL_FETE_PLAN.sourceShareToken,
	);
	const [alias, setAlias] = useState<string>(OFFICIAL_FETE_PLAN.slug);
	const [title, setTitle] = useState<string>(OFFICIAL_FETE_PLAN.routeTitle);
	const [description, setDescription] = useState<string>(
		OFFICIAL_FETE_PLAN.routeSummary,
	);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [searchResults, setSearchResults] = useState<SharedPlanSearchResult[]>(
		[],
	);
	const [archiveSourceSlug, setArchiveSourceSlug] = useState<string>(
		OFFICIAL_FETE_PLAN.slug,
	);
	const [archiveSlug, setArchiveSlug] = useState<string>(
		OFFICIAL_FETE_PLAN.archiveSlug,
	);
	const [redirectSlug, setRedirectSlug] = useState<string>("");
	const [redirectToSlug, setRedirectToSlug] = useState<string>(
		OFFICIAL_FETE_PLAN.slug,
	);
	const [goneSlug, setGoneSlug] = useState<string>("");
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState(
		initialPayload?.success ? "" : (initialPayload?.error ?? ""),
	);
	const [isBusy, setIsBusy] = useState(false);

	const officialItem = useMemo(
		() =>
			items.find((item) =>
				item.aliases.some((candidate) => candidate.pathSlug === alias),
			),
		[items, alias],
	);

	const applyItems = useCallback((nextItems?: PublishedPlanAdminSummary[]) => {
		if (nextItems) setItems(nextItems);
	}, []);

	const runMutation = useCallback(
		async (
			operation: () => Promise<{
				success: boolean;
				items?: PublishedPlanAdminSummary[];
				message?: string;
				error?: string;
			}>,
		) => {
			setIsBusy(true);
			setStatusMessage("");
			setErrorMessage("");
			try {
				const result = await operation();
				if (!result.success) {
					throw new Error(result.error || "Published plan action failed");
				}
				applyItems(result.items);
				setStatusMessage(result.message || "Published plan action saved");
			} catch (error) {
				setErrorMessage(
					error instanceof Error
						? error.message
						: "Unknown published plan error",
				);
			} finally {
				setIsBusy(false);
			}
		},
		[applyItems],
	);

	const refresh = useCallback(async () => {
		await runMutation(async () => getAdminPublishedPlans());
	}, [runMutation]);

	const publish = useCallback(async () => {
		await runMutation(async () =>
			publishSharedPlanAsOfficial(undefined, {
				shareToken,
				slug: alias,
				title,
				description,
			}),
		);
	}, [alias, description, runMutation, shareToken, title]);

	const searchSharedPlans = useCallback(async () => {
		setIsBusy(true);
		setStatusMessage("");
		setErrorMessage("");
		try {
			const result = await searchSharedPlansForPublishing(
				undefined,
				searchQuery,
			);
			if (!result.success) {
				throw new Error(result.error || "Shared plan search failed");
			}
			setSearchResults(result.results ?? []);
			setStatusMessage(`Found ${result.results?.length ?? 0} shared plans`);
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Unknown shared plan search error",
			);
		} finally {
			setIsBusy(false);
		}
	}, [searchQuery]);

	const republish = useCallback(
		async (publishedPlanId: string) => {
			await runMutation(async () =>
				republishOfficialPlanFromSource(undefined, publishedPlanId),
			);
		},
		[runMutation],
	);

	const createArchive = useCallback(async () => {
		await runMutation(async () =>
			createPublishedPlanArchiveAlias(undefined, {
				sourceSlug: archiveSourceSlug,
				archiveSlug,
			}),
		);
	}, [archiveSlug, archiveSourceSlug, runMutation]);

	const redirectAlias = useCallback(async () => {
		await runMutation(async () =>
			redirectPublishedPlanAlias(undefined, {
				slug: redirectSlug,
				redirectToSlug,
			}),
		);
	}, [redirectSlug, redirectToSlug, runMutation]);

	const markGone = useCallback(async () => {
		await runMutation(async () =>
			markPublishedPlanAliasGone(undefined, goneSlug),
		);
	}, [goneSlug, runMutation]);

	return (
		<Card className="scroll-mt-44">
			<CardHeader className="border-b">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Published Plans</CardTitle>
						<CardDescription>
							App-owned snapshots for official public route URLs.
						</CardDescription>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={refresh}
						disabled={isBusy}
						className="rounded-full"
					>
						<RefreshCw className="h-4 w-4" />
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-6 pt-4">
				{errorMessage ? (
					<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{errorMessage}
					</p>
				) : null}
				{statusMessage ? (
					<p className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
						{statusMessage}
					</p>
				) : null}

				<section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
					<div className="rounded-lg border border-border/70 p-4">
						<div className="flex items-center gap-2">
							<Route className="h-4 w-4 text-muted-foreground" />
							<h3 className="font-medium">Publish from shared plan</h3>
						</div>
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							<div className="sm:col-span-2">
								<Label htmlFor="published-plan-token">Shared token</Label>
								<Input
									id="published-plan-token"
									value={shareToken}
									onChange={(event) => setShareToken(event.target.value)}
									placeholder="Paste a /plans/:token token"
								/>
							</div>
							<div>
								<Label htmlFor="published-plan-alias">Alias</Label>
								<Input
									id="published-plan-alias"
									value={alias}
									onChange={(event) => setAlias(event.target.value)}
									placeholder="fete"
								/>
							</div>
							<div>
								<Label htmlFor="published-plan-title">Title</Label>
								<Input
									id="published-plan-title"
									value={title}
									onChange={(event) => setTitle(event.target.value)}
								/>
							</div>
							<div className="sm:col-span-2">
								<Label htmlFor="published-plan-description">Description</Label>
								<Textarea
									id="published-plan-description"
									value={description}
									onChange={(event) => setDescription(event.target.value)}
									rows={3}
								/>
							</div>
						</div>
						<div className="mt-4 flex flex-wrap gap-2">
							<Button
								type="button"
								onClick={publish}
								disabled={isBusy || !shareToken.trim() || !alias.trim()}
								className="rounded-full"
							>
								Publish /plans/{alias || OFFICIAL_FETE_PLAN.slug}
							</Button>
							<Link
								href={`/plans/${alias || OFFICIAL_FETE_PLAN.slug}`}
								className={cn(
									buttonVariants({ variant: "outline" }),
									"rounded-full",
								)}
							>
								Preview
								<ArrowUpRight className="h-4 w-4" />
							</Link>
						</div>
					</div>

					<div className="rounded-lg border border-border/70 p-4">
						<div className="flex items-center gap-2">
							<Search className="h-4 w-4 text-muted-foreground" />
							<h3 className="font-medium">Search shared plans</h3>
						</div>
						<div className="mt-4 flex gap-2">
							<Input
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="owner, title, date, token"
							/>
							<Button
								type="button"
								variant="outline"
								onClick={searchSharedPlans}
								disabled={isBusy}
							>
								Search
							</Button>
						</div>
						<div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
							{searchResults.map((result) => (
								<button
									key={result.shareToken}
									type="button"
									onClick={() => {
										setShareToken(result.shareToken);
										setTitle(OFFICIAL_FETE_PLAN.routeTitle || result.title);
									}}
									className="w-full rounded-md border border-border/70 p-3 text-left text-sm transition hover:bg-accent"
								>
									<span className="font-medium">{result.title}</span>
									<span className="mt-1 block text-xs text-muted-foreground">
										{result.ownerDisplayName} / {result.planDate} /{" "}
										{result.stopCount} stops
									</span>
									<span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
										{result.shareToken}
									</span>
								</button>
							))}
						</div>
					</div>
				</section>

				<section className="space-y-3">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h3 className="font-medium">Published plan records</h3>
							<p className="text-sm text-muted-foreground">
								Aliases resolve before share tokens. Source status compares the
								current shared plan against the frozen version.
							</p>
						</div>
						{officialItem ? (
							<Link
								href="/plans/fete"
								className={cn(
									buttonVariants({ variant: "outline" }),
									"rounded-full",
								)}
							>
								Open /plans/fete
								<ArrowUpRight className="h-4 w-4" />
							</Link>
						) : null}
					</div>
					{items.length === 0 ? (
						<p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
							No published plans yet. Publish the current shared route as
							/plans/fete to create the first app-owned snapshot.
						</p>
					) : (
						<div className="grid gap-3">
							{items.map((item) => (
								<div
									key={item.plan.id}
									className="rounded-lg border border-border/70 p-4"
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<div className="flex flex-wrap items-center gap-2">
												<h4 className="font-medium">{item.plan.title}</h4>
												<Badge variant="secondary">{item.plan.status}</Badge>
												<Badge variant={sourceStatusVariant(item.sourceStatus)}>
													source {SOURCE_STATUS_LABEL[item.sourceStatus]}
												</Badge>
											</div>
											<p className="mt-1 text-sm text-muted-foreground">
												Version {item.activeVersion?.versionNumber ?? "-"} /{" "}
												{item.stopCount} stops /{" "}
												{item.activeVersion?.planDate ?? "no date"}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												Published{" "}
												{formatDateTime(item.activeVersion?.publishedAt)}
												{item.sourcePlan
													? ` / source updated ${formatDateTime(item.sourcePlan.updatedAt)}`
													: ""}
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											{item.aliases.map((candidate) => (
												<Link
													key={candidate.pathSlug}
													href={`/plans/${candidate.pathSlug}`}
													className={cn(
														buttonVariants({ variant: "outline", size: "sm" }),
														"rounded-full",
													)}
												>
													/plans/{candidate.pathSlug}
												</Link>
											))}
											<Button
												type="button"
												size="sm"
												onClick={() => republish(item.plan.id)}
												disabled={isBusy || !item.plan.sourceShareToken}
												className="rounded-full"
											>
												Republish
											</Button>
										</div>
									</div>
									{item.sourceStatus !== "current" &&
									item.sourceStatus !== "none" ? (
										<p className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
											Source is {SOURCE_STATUS_LABEL[item.sourceStatus]}. Public
											aliases still serve the frozen published version until an
											admin republishes or redirects them.
										</p>
									) : null}
								</div>
							))}
						</div>
					)}
				</section>

				<section className="grid gap-4 lg:grid-cols-3">
					<div className="rounded-lg border border-border/70 p-4">
						<div className="flex items-center gap-2">
							<Archive className="h-4 w-4 text-muted-foreground" />
							<h3 className="font-medium">Archive alias</h3>
						</div>
						<div className="mt-4 space-y-3">
							<div>
								<Label htmlFor="archive-source-slug">Source alias</Label>
								<Input
									id="archive-source-slug"
									value={archiveSourceSlug}
									onChange={(event) => setArchiveSourceSlug(event.target.value)}
								/>
							</div>
							<div>
								<Label htmlFor="archive-slug">Archive alias</Label>
								<Input
									id="archive-slug"
									value={archiveSlug}
									onChange={(event) => setArchiveSlug(event.target.value)}
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={createArchive}
								disabled={
									isBusy || !archiveSourceSlug.trim() || !archiveSlug.trim()
								}
								className="rounded-full"
							>
								Create archive alias
							</Button>
						</div>
					</div>

					<div className="rounded-lg border border-border/70 p-4">
						<h3 className="font-medium">Redirect alias</h3>
						<div className="mt-4 space-y-3">
							<div>
								<Label htmlFor="redirect-slug">Alias to redirect</Label>
								<Input
									id="redirect-slug"
									value={redirectSlug}
									onChange={(event) => setRedirectSlug(event.target.value)}
									placeholder="old-fete"
								/>
							</div>
							<div>
								<Label htmlFor="redirect-to-slug">Redirect target</Label>
								<Input
									id="redirect-to-slug"
									value={redirectToSlug}
									onChange={(event) => setRedirectToSlug(event.target.value)}
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={redirectAlias}
								disabled={
									isBusy || !redirectSlug.trim() || !redirectToSlug.trim()
								}
								className="rounded-full"
							>
								Redirect alias
							</Button>
						</div>
					</div>

					<div className="rounded-lg border border-border/70 p-4">
						<h3 className="font-medium">Mark alias gone</h3>
						<div className="mt-4 space-y-3">
							<div>
								<Label htmlFor="gone-slug">Alias</Label>
								<Input
									id="gone-slug"
									value={goneSlug}
									onChange={(event) => setGoneSlug(event.target.value)}
									placeholder="retired-plan"
								/>
							</div>
							<Button
								type="button"
								variant="destructive"
								onClick={markGone}
								disabled={isBusy || !goneSlug.trim()}
								className="rounded-full"
							>
								Mark gone
							</Button>
						</div>
					</div>
				</section>
			</CardContent>
		</Card>
	);
}
