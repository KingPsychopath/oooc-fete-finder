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
	getAdminSearchChipSettings,
	updateAdminSearchChipSettings,
} from "@/features/events/search-chip-actions";
import { useCallback, useEffect, useState } from "react";

type SearchChipSettingsPayload = Awaited<
	ReturnType<typeof getAdminSearchChipSettings>
>;

interface SearchChipSettingsCardProps {
	initialSettings?: SearchChipSettingsPayload;
}

const formatAdminDateTime = (isoDate: string): string => {
	const time = new Date(isoDate).getTime();
	if (!Number.isFinite(time)) return "Unknown time";
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "short",
		timeStyle: "medium",
		timeZone: "Europe/London",
	}).format(time);
};

const formatRefreshInterval = (seconds: number | false | undefined): string => {
	if (seconds === false) return "Manual";
	if (!seconds) return "Unknown";
	if (seconds % 60 === 0) return `${seconds / 60} min`;
	return `${seconds}s`;
};

export const SearchChipSettingsCard = ({
	initialSettings,
}: SearchChipSettingsCardProps) => {
	const initial =
		initialSettings?.success && initialSettings.settings
			? initialSettings.settings
			: {
					dynamicChipsEnabled: true,
					maxDynamicChips: 4,
					updatedAt: new Date(0).toISOString(),
				};

	const [enabled, setEnabled] = useState(initial.dynamicChipsEnabled);
	const [maxDynamicChips, setMaxDynamicChips] = useState(
		initial.maxDynamicChips,
	);
	const [savedSettings, setSavedSettings] = useState({
		dynamicChipsEnabled: initial.dynamicChipsEnabled,
		maxDynamicChips: initial.maxDynamicChips,
	});
	const [storeMeta, setStoreMeta] = useState(
		initialSettings?.success ? initialSettings.store : undefined,
	);
	const [signalStatus, setSignalStatus] = useState(
		initialSettings?.success ? initialSettings.signalStatus : undefined,
	);
	const [chipDebugMatches, setChipDebugMatches] = useState(
		initialSettings?.success ? (initialSettings.chipDebugMatches ?? []) : [],
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState(
		initialSettings?.success ? "" : (initialSettings?.error ?? ""),
	);
	const toggleTitle = enabled
		? "Disable dynamic homepage chips; curated static chips stay visible"
		: "Enable dynamic homepage chips from anonymous aggregate search signals";
	const dynamicStateLabel =
		!enabled || maxDynamicChips === 0 ? "Curated only" : "Dynamic On";
	const dynamicStateVariant =
		enabled && maxDynamicChips > 0 ? "default" : "outline";

	const applySettings = useCallback(
		(
			settings: {
				dynamicChipsEnabled: boolean;
				maxDynamicChips: number;
			},
			store:
				| {
						provider: "file" | "memory" | "postgres";
						location: string;
						key: string;
						updatedAt: string;
						updatedBy: string;
				  }
				| undefined,
		) => {
			setEnabled(settings.dynamicChipsEnabled);
			setMaxDynamicChips(settings.maxDynamicChips);
			setSavedSettings({
				dynamicChipsEnabled: settings.dynamicChipsEnabled,
				maxDynamicChips: settings.maxDynamicChips,
			});
			setStoreMeta(store);
		},
		[],
	);

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		setStatusMessage("");
		setErrorMessage("");
		try {
			const result = await getAdminSearchChipSettings();
			if (!result.success || !result.settings) {
				throw new Error(result.error || "Failed to load search chip settings");
			}
			applySettings(result.settings, result.store);
			setSignalStatus(result.signalStatus);
			setChipDebugMatches(result.chipDebugMatches ?? []);
			setStatusMessage("Search chip settings refreshed");
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown refresh error",
			);
		} finally {
			setIsRefreshing(false);
		}
	}, [applySettings]);

	useEffect(() => {
		if (initialSettings?.success) return;
		let active = true;
		const loadInitialSettings = async () => {
			setIsRefreshing(true);
			setErrorMessage("");
			try {
				const result = await getAdminSearchChipSettings();
				if (!result.success || !result.settings) {
					throw new Error(
						result.error || "Failed to load search chip settings",
					);
				}
				if (!active) return;
				applySettings(result.settings, result.store);
				setSignalStatus(result.signalStatus);
				setChipDebugMatches(result.chipDebugMatches ?? []);
			} catch (error) {
				if (!active) return;
				setErrorMessage(
					error instanceof Error ? error.message : "Unknown load error",
				);
			} finally {
				if (active) setIsRefreshing(false);
			}
		};
		void loadInitialSettings();
		return () => {
			active = false;
		};
	}, [applySettings, initialSettings?.success]);

	const handleToggleEnabled = useCallback(async () => {
		const nextEnabled = !enabled;
		setEnabled(nextEnabled);
		setIsSaving(true);
		setStatusMessage("");
		setErrorMessage("");
		try {
			const result = await updateAdminSearchChipSettings(undefined, {
				dynamicChipsEnabled: nextEnabled,
				maxDynamicChips,
			});
			if (!result.success || !result.settings) {
				throw new Error(
					result.error || "Failed to update search chip settings",
				);
			}
			applySettings(result.settings, result.store);
			setSignalStatus(result.signalStatus);
			setChipDebugMatches(result.chipDebugMatches ?? []);
			setStatusMessage(result.message || "Search chip settings saved");
		} catch (error) {
			setEnabled(!nextEnabled);
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown toggle error",
			);
		} finally {
			setIsSaving(false);
		}
	}, [applySettings, enabled, maxDynamicChips]);

	const handleSaveSettings = useCallback(async () => {
		setIsSaving(true);
		setStatusMessage("");
		setErrorMessage("");
		try {
			const result = await updateAdminSearchChipSettings(undefined, {
				dynamicChipsEnabled: enabled,
				maxDynamicChips,
			});
			if (!result.success || !result.settings) {
				throw new Error(
					result.error || "Failed to update search chip settings",
				);
			}
			applySettings(result.settings, result.store);
			setSignalStatus(result.signalStatus);
			setChipDebugMatches(result.chipDebugMatches ?? []);
			setStatusMessage(result.message || "Search chip settings saved");
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown save error",
			);
		} finally {
			setIsSaving(false);
		}
	}, [applySettings, enabled, maxDynamicChips]);

	const hasUnsavedSettings =
		enabled !== savedSettings.dynamicChipsEnabled ||
		maxDynamicChips !== savedSettings.maxDynamicChips;

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Homepage Search Chips</CardTitle>
						<CardDescription>
							Control whether anonymous aggregate searches can add Popular now
							chips beside the curated suggestions.
						</CardDescription>
					</div>
					<Badge variant={dynamicStateVariant}>
						{dynamicStateLabel}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Dynamic Chips
						</p>
						<p className="mt-1 text-sm font-medium">
							{dynamicStateLabel}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Max Popular
						</p>
						<p className="mt-1 text-sm font-medium">{maxDynamicChips}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Updated
						</p>
						<p className="mt-1 text-sm font-medium">
							{storeMeta?.updatedAt
								? formatAdminDateTime(storeMeta.updatedAt)
								: "Never"}
						</p>
					</div>
				</div>

				<div className="space-y-3 rounded-md border bg-background/60 p-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p className="text-sm font-medium">Dynamic chip cap</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Limit how many anonymous popular-search chips can join the
								curated homepage chips.
							</p>
						</div>
						{hasUnsavedSettings ? (
							<Badge variant="secondary">Unsaved</Badge>
						) : null}
					</div>
					<div className="flex flex-wrap gap-2">
						{[0, 1, 2, 3, 4].map((count) => (
							<Button
								key={count}
								type="button"
								size="sm"
								variant={maxDynamicChips === count ? "default" : "outline"}
								disabled={isSaving || isRefreshing}
								onClick={() => setMaxDynamicChips(count)}
								title={
									count === 0
										? "Keep only curated static chips"
										: `Allow up to ${count} dynamic popular chip${count === 1 ? "" : "s"}`
								}
							>
								{count}
							</Button>
						))}
					</div>
				</div>

				<p className="text-sm text-muted-foreground">
					Static chips always remain curated. Dynamic chips are canonicalized,
					filtered for safety, capped by the control above, and ranked from anonymous
					aggregate searches over the last{" "}
					{signalStatus?.windowDays?.toLocaleString() ?? 7} days.
				</p>

				<div className="rounded-md border bg-muted/30 p-3 text-sm">
					<div className="grid gap-3 sm:grid-cols-3">
						<div>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Signal Freshness
							</p>
							<p className="mt-1 font-medium">
								{signalStatus?.lastSeenAt
									? formatAdminDateTime(signalStatus.lastSeenAt)
									: "No recent searches"}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Signals
							</p>
							<p className="mt-1 font-medium">
								{signalStatus?.available === false
									? "Unavailable"
									: (signalStatus?.signalCount ?? 0).toLocaleString()}
							</p>
						</div>
						<div>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Public Refresh
							</p>
							<p className="mt-1 font-medium">
								{formatRefreshInterval(signalStatus?.cacheRevalidateSeconds)}
							</p>
						</div>
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						Counts can stay stable when the same searches dominate the 7-day
						window; the 2-day recent window only boosts newer matches, it does
						not guarantee visible churn.
					</p>
					{signalStatus?.error && (
						<p className="mt-2 text-xs text-rose-700">{signalStatus.error}</p>
					)}
				</div>

				<div className="rounded-md border bg-background/60 p-3 text-sm">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
								Popular Debug
							</p>
							<p className="mt-1 font-medium">
								{chipDebugMatches.length > 0
									? `${chipDebugMatches.length.toLocaleString()} visible match${
											chipDebugMatches.length === 1 ? "" : "es"
										}`
									: "No visible dynamic chips"}
							</p>
						</div>
						<Badge variant="outline">Admin only</Badge>
					</div>
					{chipDebugMatches.length > 0 && (
						<div className="mt-3 grid gap-2">
							{chipDebugMatches.map((match) => (
								<div
									key={`${match.label}-${match.matchedSignalQuery}`}
									className="rounded-md border bg-muted/25 p-2"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="font-medium">{match.label}</p>
										<div className="flex flex-wrap gap-1">
											{match.eventDate && (
												<Badge variant="outline">{match.eventDate}</Badge>
											)}
											<Badge variant="secondary">{match.kind}</Badge>
										</div>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										Matched search: "{match.matchedSignalQuery}" -{" "}
										{match.matchedSignalCount.toLocaleString()} total -{" "}
										{match.matchedSignalRecentCount.toLocaleString()} recent
										{match.matchedSignalSources &&
										match.matchedSignalSources.length > 0
											? ` - ${match.matchedSignalSources.join(", ")}`
											: ""}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Confidence {(match.confidence * 100).toFixed(0)}% - Score{" "}
										{match.score.toFixed(1)}
										{match.matchedSignalLastSeenAt
											? ` - Last seen ${formatAdminDateTime(
													match.matchedSignalLastSeenAt,
												)}`
											: ""}
									</p>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant={enabled ? "outline" : "default"}
						disabled={isSaving || isRefreshing}
						onClick={handleToggleEnabled}
						title={toggleTitle}
					>
						{enabled ? "Turn Off Dynamic Chips" : "Turn On Dynamic Chips"}
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={isSaving || isRefreshing || !hasUnsavedSettings}
						onClick={handleSaveSettings}
						title={
							hasUnsavedSettings
								? "Save dynamic chip status and cap"
								: "No search chip changes to save"
						}
					>
						{isSaving ? "Saving..." : "Save Chip Settings"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleRefresh}
						disabled={isSaving || isRefreshing}
						title="Reload dynamic chip settings and signal debug data"
					>
						{isRefreshing ? "Refreshing..." : "Refresh"}
					</Button>
				</div>

				{statusMessage && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
						{statusMessage}
					</div>
				)}

				{errorMessage && (
					<div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
						{errorMessage}
					</div>
				)}

				{storeMeta?.location && (
					<p className="text-xs text-muted-foreground">
						Store location: {storeMeta.location}
					</p>
				)}
			</CardContent>
		</Card>
	);
};
