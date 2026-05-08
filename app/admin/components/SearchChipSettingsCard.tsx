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
	const [storeMeta, setStoreMeta] = useState(
		initialSettings?.success ? initialSettings.store : undefined,
	);
	const [isSaving, setIsSaving] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [statusMessage, setStatusMessage] = useState("");
	const [errorMessage, setErrorMessage] = useState(
		initialSettings?.success ? "" : (initialSettings?.error ?? ""),
	);

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

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Search Chips</CardTitle>
						<CardDescription>
							Control whether anonymous aggregate searches can add Popular now
							chips beside the curated suggestions.
						</CardDescription>
					</div>
					<Badge variant={enabled ? "default" : "outline"}>
						{enabled ? "Dynamic On" : "Dynamic Off"}
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
							{enabled ? "Enabled" : "Disabled"}
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

				<p className="text-sm text-muted-foreground">
					Static chips always remain curated. Dynamic chips are canonicalized,
					filtered for safety, capped at four, and refreshed from recent
					aggregate searches.
				</p>

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant={enabled ? "outline" : "default"}
						disabled={isSaving || isRefreshing}
						onClick={handleToggleEnabled}
					>
						{enabled ? "Turn Off Dynamic Chips" : "Turn On Dynamic Chips"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleRefresh}
						disabled={isSaving || isRefreshing}
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
