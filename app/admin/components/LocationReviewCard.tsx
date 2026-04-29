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
import {
	clearEventLocationResolution,
	getEventLocationReviewData,
	resolveEventLocation,
	saveManualEventLocation,
} from "@/features/data-management/actions";
import type {
	EventLocationReviewItem,
	EventLocationReviewPayload,
} from "@/features/data-management/actions";
import {
	type ParisArrondissement,
	formatLocationAreaShort,
	getLocationAreaSortValue,
} from "@/features/events/types";
import {
	type MapLinkProvider,
	buildMapLink,
} from "@/features/locations/map-link-builder";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type LocationReviewCardProps = {
	initialPayload?: EventLocationReviewPayload;
};

type ManualDraft = {
	locationId: string;
	lat: string;
	lng: string;
};

type LocationStatus =
	| "manual"
	| "geocoded"
	| "approximate"
	| "unresolved"
	| "needs-location";
type StatusFilter = "all" | "needs-review" | "trusted" | LocationStatus;
type SortMode =
	| "needs-review"
	| "location-asc"
	| "arrondissement-asc"
	| "events-desc"
	| "updated-desc";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "needs-review", label: "Review needed" },
	{ value: "trusted", label: "Trusted" },
	{ value: "unresolved", label: "Unresolved" },
	{ value: "approximate", label: "Approximate" },
	{ value: "manual", label: "Manual" },
	{ value: "geocoded", label: "Geocoded" },
	{ value: "needs-location", label: "Needs location" },
];

const SORT_MODES: Array<{ value: SortMode; label: string }> = [
	{ value: "needs-review", label: "Needs review first" },
	{ value: "location-asc", label: "Location A-Z" },
	{ value: "arrondissement-asc", label: "Arrondissement" },
	{ value: "events-desc", label: "Most events" },
	{ value: "updated-desc", label: "Recently resolved" },
];

const PAGE_SIZES = [10, 25, 50] as const;
const MAP_LINK_PROVIDERS: Array<{ value: MapLinkProvider; label: string }> = [
	{ value: "google", label: "Google" },
	{ value: "apple", label: "Apple" },
	{ value: "geo", label: "Native geo" },
];

const getLocationStatus = (item: EventLocationReviewItem): LocationStatus => {
	if (!item.isResolvable) return "needs-location";
	if (!item.resolution) return "unresolved";
	if (item.resolution.source === "manual") return "manual";
	if (item.resolution.source === "geocoded") return "geocoded";
	if (item.resolution.source === "estimated_arrondissement") {
		return "approximate";
	}
	return "unresolved";
};

const isTrustedItem = (item: EventLocationReviewItem): boolean => {
	const status = getLocationStatus(item);
	return status === "manual" || status === "geocoded";
};

const getStatusVariant = (
	item: EventLocationReviewItem,
): "default" | "secondary" | "outline" | "destructive" => {
	const status = getLocationStatus(item);
	if (status === "needs-location") return "destructive";
	if (status === "manual") return "default";
	if (status === "geocoded") return "secondary";
	return "outline";
};

const getStatusLabel = (item: EventLocationReviewItem): string => {
	const status = getLocationStatus(item);
	if (status === "needs-location") return "Needs location";
	if (status === "manual") return "Manual";
	if (status === "geocoded") return "Geocoded";
	if (status === "approximate") return "Approximate";
	return "Unresolved";
};

const getReviewPriority = (item: EventLocationReviewItem): number => {
	const status = getLocationStatus(item);
	if (status === "unresolved") return 0;
	if (status === "approximate") return 1;
	if (status === "needs-location") return 2;
	if (status === "geocoded") return 3;
	return 4;
};

const formatArrondissement = (arrondissement: ParisArrondissement): string =>
	formatLocationAreaShort(arrondissement);

const formatCoordinates = (item: EventLocationReviewItem): string => {
	const coordinates = item.resolution?.coordinates;
	if (!coordinates) return "No coordinates";
	return `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`;
};

const getMapBasisLabel = (item: EventLocationReviewItem): string => {
	if (isTrustedItem(item)) return "Using trusted coordinates";
	if (getLocationStatus(item) === "approximate") {
		return "Using text search; approximate coords are review-only";
	}
	return "Using text search";
};

const getClearResolutionLabel = (item: EventLocationReviewItem): string => {
	if (item.resolution) return "Clear stored coords";
	return "No stored coords";
};

const getResolvedTimestamp = (item: EventLocationReviewItem): string =>
	item.resolution?.lastResolvedAt ?? item.resolution?.lastUpdated ?? "";

const matchesStatusFilter = (
	item: EventLocationReviewItem,
	filter: StatusFilter,
): boolean => {
	if (filter === "all") return true;
	if (filter === "needs-review") return getReviewPriority(item) < 3;
	if (filter === "trusted") return isTrustedItem(item);
	return getLocationStatus(item) === filter;
};

const compareArrondissement = (
	left: ParisArrondissement,
	right: ParisArrondissement,
): number => {
	if (left === right) return 0;
	return getLocationAreaSortValue(left) - getLocationAreaSortValue(right);
};

const getMapLink = (
	item: EventLocationReviewItem,
	provider: MapLinkProvider,
): string =>
	buildMapLink({
		locationInput: item.locationName,
		arrondissement: item.arrondissement,
		resolution: item.resolution,
		provider,
	});

const canResolveWithProvider = (item: EventLocationReviewItem): boolean =>
	item.isResolvable && getLocationStatus(item) !== "needs-location";

const canBatchResolveWithProvider = (item: EventLocationReviewItem): boolean =>
	canResolveWithProvider(item) && !isTrustedItem(item);

const hasStoredResolution = (item: EventLocationReviewItem): boolean =>
	Boolean(item.resolution);

export const LocationReviewCard = ({
	initialPayload,
}: LocationReviewCardProps) => {
	const [items, setItems] = useState<EventLocationReviewItem[]>(
		initialPayload?.success ? (initialPayload.items ?? []) : [],
	);
	const [providerConfigured, setProviderConfigured] = useState(
		initialPayload?.success ? initialPayload.providerConfigured : false,
	);
	const [isLoading, setIsLoading] = useState(!initialPayload?.success);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null);
	const [message, setMessage] = useState("");
	const [error, setError] = useState(initialPayload?.error ?? "");
	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] =
		useState<StatusFilter>("needs-review");
	const [sortMode, setSortMode] = useState<SortMode>("needs-review");
	const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
	const [page, setPage] = useState(1);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
	const [isBatchRunning, setIsBatchRunning] = useState(false);

	const loadReviewData = useCallback(async () => {
		setIsLoading(true);
		setError("");
		try {
			const result = await getEventLocationReviewData();
			if (!result.success) {
				throw new Error(result.error || "Failed to load locations");
			}
			setItems(result.items ?? []);
			setProviderConfigured(result.providerConfigured);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Failed to load locations",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialPayload?.success) return;
		void loadReviewData();
	}, [initialPayload?.success, loadReviewData]);

	const withItemTask = async (
		item: EventLocationReviewItem,
		task: () => Promise<{ success: boolean; message: string; error?: string }>,
	) => {
		setBusyId(item.id);
		setMessage("");
		setError("");
		try {
			const result = await task();
			if (!result.success) {
				throw new Error(result.error || result.message);
			}
			setMessage(result.message);
			setManualDraft(null);
			await loadReviewData();
		} catch (taskError) {
			setError(
				taskError instanceof Error
					? taskError.message
					: "Location update failed",
			);
		} finally {
			setBusyId(null);
		}
	};

	const runBatchTask = async (
		targetItems: EventLocationReviewItem[],
		task: (item: EventLocationReviewItem) => Promise<{
			success: boolean;
			message: string;
			error?: string;
		}>,
		successLabel: string,
	) => {
		if (targetItems.length === 0) return;
		setIsBatchRunning(true);
		setMessage("");
		setError("");
		try {
			let completed = 0;
			const failures: string[] = [];
			for (const item of targetItems) {
				const result = await task(item);
				if (result.success) {
					completed += 1;
				} else {
					failures.push(
						`${item.locationName || "TBA"}: ${result.error || result.message}`,
					);
				}
			}
			setSelectedIds(new Set());
			setManualDraft(null);
			await loadReviewData();
			setMessage(`${successLabel}: ${completed} of ${targetItems.length}`);
			if (failures.length > 0) {
				setError(failures.slice(0, 3).join("; "));
			}
		} catch (batchError) {
			setError(
				batchError instanceof Error
					? batchError.message
					: "Batch update failed",
			);
		} finally {
			setIsBatchRunning(false);
		}
	};

	const handleResolve = (item: EventLocationReviewItem) =>
		withItemTask(item, async () =>
			resolveEventLocation(undefined, item.locationName, item.arrondissement, {
				forceRefresh: true,
			}),
		);

	const handleClear = (item: EventLocationReviewItem) =>
		withItemTask(item, async () =>
			clearEventLocationResolution(
				undefined,
				item.locationName,
				item.arrondissement,
			),
		);

	const handleManualSave = (item: EventLocationReviewItem) => {
		if (!manualDraft || manualDraft.locationId !== item.id) return;
		void withItemTask(item, async () =>
			saveManualEventLocation(
				undefined,
				item.locationName,
				item.arrondissement,
				{
					lat: Number(manualDraft.lat),
					lng: Number(manualDraft.lng),
				},
			),
		);
	};

	const counts = useMemo(
		() => ({
			needsReview: items.filter((item) => getReviewPriority(item) < 3).length,
			trusted: items.filter(isTrustedItem).length,
			unresolved: items.filter(
				(item) => getLocationStatus(item) === "unresolved",
			).length,
			approximate: items.filter(
				(item) => getLocationStatus(item) === "approximate",
			).length,
			needsLocation: items.filter(
				(item) => getLocationStatus(item) === "needs-location",
			).length,
		}),
		[items],
	);

	const filteredItems = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const nextItems = items.filter((item) => {
			if (!matchesStatusFilter(item, statusFilter)) return false;
			if (!needle) return true;
			const haystack = [
				item.locationName,
				formatArrondissement(item.arrondissement),
				getStatusLabel(item),
				item.resolution?.formattedAddress ?? "",
				item.resolution?.provider ?? "",
				...item.sampleEventNames,
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(needle);
		});

		return nextItems.sort((left, right) => {
			if (sortMode === "location-asc") {
				return left.locationName.localeCompare(right.locationName);
			}
			if (sortMode === "arrondissement-asc") {
				return (
					compareArrondissement(left.arrondissement, right.arrondissement) ||
					left.locationName.localeCompare(right.locationName)
				);
			}
			if (sortMode === "events-desc") {
				return (
					right.eventCount - left.eventCount ||
					left.locationName.localeCompare(right.locationName)
				);
			}
			if (sortMode === "updated-desc") {
				return (
					getResolvedTimestamp(right).localeCompare(
						getResolvedTimestamp(left),
					) || left.locationName.localeCompare(right.locationName)
				);
			}
			return (
				getReviewPriority(left) - getReviewPriority(right) ||
				right.eventCount - left.eventCount ||
				left.locationName.localeCompare(right.locationName)
			);
		});
	}, [items, query, sortMode, statusFilter]);

	const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
	const safePage = Math.min(page, totalPages);
	const pageStart = (safePage - 1) * pageSize;
	const visibleItems = filteredItems.slice(pageStart, pageStart + pageSize);
	const selectedItems = items.filter((item) => selectedIds.has(item.id));
	const selectedResolvableItems = selectedItems.filter(
		canBatchResolveWithProvider,
	);
	const selectedStoredItems = selectedItems.filter(hasStoredResolution);
	const visibleSelectedCount = visibleItems.filter((item) =>
		selectedIds.has(item.id),
	).length;
	const allVisibleSelected =
		visibleItems.length > 0 && visibleSelectedCount === visibleItems.length;

	const toggleSelected = (itemId: string) => {
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(itemId)) {
				next.delete(itemId);
			} else {
				next.add(itemId);
			}
			return next;
		});
	};

	const selectItems = (nextItems: EventLocationReviewItem[]) => {
		setSelectedIds(new Set(nextItems.map((item) => item.id)));
	};

	const clearVisibleSelection = () => {
		setSelectedIds((current) => {
			const next = new Set(current);
			for (const item of visibleItems) {
				next.delete(item.id);
			}
			return next;
		});
	};

	const handleBatchResolve = () =>
		runBatchTask(
			selectedResolvableItems,
			(item) =>
				resolveEventLocation(
					undefined,
					item.locationName,
					item.arrondissement,
					{
						forceRefresh: true,
					},
				),
			"Resolved selected locations",
		);

	const handleBatchClear = () =>
		runBatchTask(
			selectedStoredItems,
			(item) =>
				clearEventLocationResolution(
					undefined,
					item.locationName,
					item.arrondissement,
				),
			"Cleared selected stored coords",
		);

	return (
		<Card className="ooo-admin-card-soft min-w-0 overflow-hidden">
			<CardHeader>
				<CardTitle className="text-2xl tracking-tight">
					Location Review
				</CardTitle>
				<CardDescription>
					Review venue coordinates used by nearby matching and trusted map
					links.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant={providerConfigured ? "default" : "outline"}>
						Geocoder {providerConfigured ? "configured" : "not configured"}
					</Badge>
					<Badge variant="outline">{counts.needsReview} need review</Badge>
					<Badge variant="secondary">{counts.trusted} trusted</Badge>
					<Badge variant="outline">{counts.unresolved} unresolved</Badge>
					{counts.approximate > 0 && (
						<Badge variant="outline">{counts.approximate} approximate</Badge>
					)}
					{counts.needsLocation > 0 && (
						<Badge variant="destructive">
							{counts.needsLocation} need location
						</Badge>
					)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void loadReviewData()}
						disabled={isLoading}
					>
						Refresh
					</Button>
				</div>

				<div className="grid gap-3 rounded-md border bg-background/55 p-3 lg:grid-cols-[minmax(240px,1fr)_180px_190px_120px]">
					<div className="space-y-2">
						<Label htmlFor="location-review-search">Search locations</Label>
						<Input
							id="location-review-search"
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setPage(1);
							}}
							placeholder="Search venue, event, address..."
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="location-review-status">Status</Label>
						<select
							id="location-review-status"
							value={statusFilter}
							onChange={(event) => {
								setStatusFilter(event.target.value as StatusFilter);
								setPage(1);
							}}
							className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
						>
							{STATUS_FILTERS.map((filter) => (
								<option key={filter.value} value={filter.value}>
									{filter.label}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="location-review-sort">Sort</Label>
						<select
							id="location-review-sort"
							value={sortMode}
							onChange={(event) => {
								setSortMode(event.target.value as SortMode);
								setPage(1);
							}}
							className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
						>
							{SORT_MODES.map((mode) => (
								<option key={mode.value} value={mode.value}>
									{mode.label}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="location-review-page-size">Rows</Label>
						<select
							id="location-review-page-size"
							value={pageSize}
							onChange={(event) => {
								setPageSize(Number(event.target.value) as typeof pageSize);
								setPage(1);
							}}
							className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
						>
							{PAGE_SIZES.map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
					</div>
				</div>

				{message && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
						{message}
					</div>
				)}
				{error && (
					<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{error}
					</div>
				)}

				<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
					<span>
						Showing {visibleItems.length} of {filteredItems.length} filtered
						locations ({items.length} total).
					</span>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={safePage <= 1}
							onClick={() => setPage((current) => Math.max(1, current - 1))}
						>
							Previous
						</Button>
						<span>
							Page {safePage} of {totalPages}
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={safePage >= totalPages}
							onClick={() =>
								setPage((current) => Math.min(totalPages, current + 1))
							}
						>
							Next
						</Button>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 rounded-md border bg-background/55 p-3 text-sm">
					<label className="flex items-center gap-2 text-xs text-muted-foreground">
						<input
							type="checkbox"
							checked={allVisibleSelected}
							disabled={visibleItems.length === 0 || isBatchRunning}
							onChange={(event) =>
								event.target.checked
									? selectItems(visibleItems)
									: clearVisibleSelection()
							}
						/>
						Select visible
					</label>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={filteredItems.length === 0 || isBatchRunning}
						onClick={() => selectItems(filteredItems)}
					>
						Select all filtered
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={selectedIds.size === 0 || isBatchRunning}
						onClick={() => setSelectedIds(new Set())}
					>
						Clear selection
					</Button>
					<span className="text-xs text-muted-foreground">
						{selectedIds.size} selected
					</span>
					<div className="ml-0 flex flex-wrap gap-2 lg:ml-auto">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={
								isBatchRunning ||
								!providerConfigured ||
								selectedResolvableItems.length === 0
							}
							onClick={() => void handleBatchResolve()}
						>
							Resolve selected
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isBatchRunning || selectedStoredItems.length === 0}
							onClick={() => void handleBatchClear()}
						>
							Clear selected coords
						</Button>
					</div>
				</div>

				<div className="max-h-[680px] space-y-2 overflow-auto pr-1">
					{isLoading ? (
						<div className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
							Loading locations...
						</div>
					) : items.length === 0 ? (
						<div className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
							No event locations found.
						</div>
					) : visibleItems.length === 0 ? (
						<div className="rounded-md border bg-background/60 p-4 text-sm text-muted-foreground">
							No locations match the current filters.
						</div>
					) : (
						visibleItems.map((item) => {
							const isBusy = busyId === item.id;
							const isEditing = manualDraft?.locationId === item.id;
							const canTestMapLinks = item.locationName.trim().length > 0;
							return (
								<div
									key={item.id}
									className="rounded-md border bg-background/60 p-3"
								>
									<div className="grid gap-3 xl:grid-cols-[minmax(260px,1.3fr)_minmax(240px,1fr)_auto]">
										<div className="min-w-0 space-y-1">
											<div className="flex flex-wrap items-center gap-2">
												<input
													type="checkbox"
													checked={selectedIds.has(item.id)}
													disabled={isBatchRunning}
													onChange={() => toggleSelected(item.id)}
													aria-label={`Select ${item.locationName || "location"}`}
												/>
												<p className="font-medium">
													{item.locationName || "TBA"}
												</p>
												<Badge variant="outline">
													{formatArrondissement(item.arrondissement)}
												</Badge>
												<Badge variant={getStatusVariant(item)}>
													{getStatusLabel(item)}
												</Badge>
											</div>
											<p className="text-xs text-muted-foreground">
												{item.eventCount} event
												{item.eventCount === 1 ? "" : "s"}:{" "}
												{item.sampleEventNames.join(", ")}
											</p>
										</div>

										<div className="min-w-0 space-y-1 text-xs text-muted-foreground">
											<p>{formatCoordinates(item)}</p>
											<p>{getMapBasisLabel(item)}</p>
											{item.resolution?.formattedAddress && (
												<p className="truncate">
													{item.resolution.formattedAddress}
												</p>
											)}
											{getResolvedTimestamp(item) && (
												<p>
													Resolved{" "}
													{new Date(
														getResolvedTimestamp(item),
													).toLocaleString()}
												</p>
											)}
											<div className="flex flex-wrap gap-1.5 pt-1">
												{MAP_LINK_PROVIDERS.map((provider) => (
													<a
														key={provider.value}
														href={
															canTestMapLinks
																? getMapLink(item, provider.value)
																: undefined
														}
														target="_blank"
														rel="noreferrer"
														aria-disabled={!canTestMapLinks}
														className={cn(
															buttonVariants({
																variant: "outline",
																size: "xs",
															}),
															!canTestMapLinks &&
																"pointer-events-none opacity-50",
														)}
													>
														{provider.label}
														<ExternalLink className="h-3 w-3" />
													</a>
												))}
											</div>
										</div>

										<div className="flex flex-wrap content-start gap-2 xl:justify-end">
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={
													isBusy || !item.isResolvable || !providerConfigured
												}
												onClick={() => void handleResolve(item)}
											>
												Resolve with provider
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={isBusy || !item.isResolvable}
												onClick={() =>
													setManualDraft({
														locationId: item.id,
														lat: item.resolution?.coordinates
															? String(item.resolution.coordinates.lat)
															: "",
														lng: item.resolution?.coordinates
															? String(item.resolution.coordinates.lng)
															: "",
													})
												}
											>
												Manual coords
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												disabled={isBusy || !item.resolution}
												onClick={() => void handleClear(item)}
											>
												{getClearResolutionLabel(item)}
											</Button>
										</div>
									</div>

									{isEditing && (
										<div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[1fr_1fr_auto]">
											<div className="space-y-2">
												<Label htmlFor={`${item.id}-lat`}>Latitude</Label>
												<Input
													id={`${item.id}-lat`}
													inputMode="decimal"
													value={manualDraft.lat}
													onChange={(event) =>
														setManualDraft({
															...manualDraft,
															lat: event.target.value,
														})
													}
													placeholder="48.85660"
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor={`${item.id}-lng`}>Longitude</Label>
												<Input
													id={`${item.id}-lng`}
													inputMode="decimal"
													value={manualDraft.lng}
													onChange={(event) =>
														setManualDraft({
															...manualDraft,
															lng: event.target.value,
														})
													}
													placeholder="2.35220"
												/>
											</div>
											<div className="flex items-end gap-2">
												<Button
													type="button"
													size="sm"
													disabled={isBusy}
													onClick={() => handleManualSave(item)}
												>
													Save
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => setManualDraft(null)}
												>
													Cancel
												</Button>
											</div>
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			</CardContent>
		</Card>
	);
};
