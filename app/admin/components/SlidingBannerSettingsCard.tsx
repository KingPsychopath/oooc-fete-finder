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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	getAdminSlidingBannerSettings,
	updateAdminSlidingBannerSettings,
} from "@/features/site-settings/actions";
import { useCallback, useMemo, useState } from "react";

type SlidingBannerSettingsPayload = Awaited<
	ReturnType<typeof getAdminSlidingBannerSettings>
>;

interface SlidingBannerSettingsCardProps {
	initialSettings?: SlidingBannerSettingsPayload;
}

const FALLBACK_MESSAGES = [
	"Curated by Out Of Office Collective",
	"Paris summer rhythm, mapped live",
	"Postgres-first event workflow",
	"Tap essentials for playlist, food and toilets",
];

const toMessageInput = (messages: string[]): string => messages.join("\n");

const parseMessageInput = (raw: string): string[] => {
	return raw
		.split(/\r?\n/g)
		.map((message) => message.replace(/\s+/g, " ").trim())
		.filter((message) => message.length > 0);
};

export const SlidingBannerSettingsCard = ({
	initialSettings,
}: SlidingBannerSettingsCardProps) => {
	const initial =
		initialSettings?.success && initialSettings.settings
			? initialSettings.settings
			: {
					enabled: true,
					messages: FALLBACK_MESSAGES,
					messageDurationMs: 4200,
					desktopMessageCount: 2 as 1 | 2,
					updatedAt: new Date(0).toISOString(),
				};

	const [enabled, setEnabled] = useState(initial.enabled);
	const [messagesInput, setMessagesInput] = useState(
		toMessageInput(initial.messages),
	);
	const [messageDurationSeconds, setMessageDurationSeconds] = useState(
		(initial.messageDurationMs / 1000).toFixed(1),
	);
	const [desktopMessageCount, setDesktopMessageCount] = useState<1 | 2>(
		initial.desktopMessageCount === 1 ? 1 : 2,
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

	const parsedMessages = useMemo(
		() => parseMessageInput(messagesInput),
		[messagesInput],
	);

	const applySettings = useCallback(
		(
			settings: {
				enabled: boolean;
				messages: string[];
				messageDurationMs: number;
				desktopMessageCount: 1 | 2;
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
			setEnabled(settings.enabled);
			setMessagesInput(toMessageInput(settings.messages));
			setMessageDurationSeconds((settings.messageDurationMs / 1000).toFixed(1));
			setDesktopMessageCount(settings.desktopMessageCount);
			setStoreMeta(store);
		},
		[],
	);

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		setStatusMessage("");
		setErrorMessage("");
		try {
			const result = await getAdminSlidingBannerSettings();
			if (!result.success || !result.settings) {
				throw new Error(result.error || "Failed to load banner settings");
			}
			applySettings(result.settings, result.store);
			setStatusMessage("Banner settings refreshed");
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown refresh error",
			);
		} finally {
			setIsRefreshing(false);
		}
	}, [applySettings]);

	const handleSave = useCallback(async () => {
		if (enabled && parsedMessages.length === 0) {
			setErrorMessage("Add at least one message or disable the banner");
			setStatusMessage("");
			return;
		}

		setIsSaving(true);
		setStatusMessage("");
		setErrorMessage("");
		try {
			const normalizedDurationMs = Math.round(
				Number.parseFloat(messageDurationSeconds) * 1000,
			);
			const result = await updateAdminSlidingBannerSettings(undefined, {
				enabled,
				messages: parsedMessages,
				messageDurationMs: normalizedDurationMs,
				desktopMessageCount,
			});

			if (!result.success || !result.settings) {
				throw new Error(result.error || "Failed to save banner settings");
			}

			applySettings(result.settings, result.store);
			setStatusMessage(result.message || "Banner settings saved");
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown save error",
			);
		} finally {
			setIsSaving(false);
		}
	}, [
		applySettings,
		desktopMessageCount,
		enabled,
		messageDurationSeconds,
		parsedMessages,
	]);

	const handleToggleEnabled = useCallback(async () => {
		const nextEnabled = !enabled;
		if (nextEnabled && parsedMessages.length === 0) {
			setErrorMessage("Add at least one message before enabling the banner");
			setStatusMessage("");
			return;
		}

		setEnabled(nextEnabled);
		setIsSaving(true);
		setStatusMessage("");
		setErrorMessage("");
		try {
			const normalizedDurationMs = Math.round(
				Number.parseFloat(messageDurationSeconds) * 1000,
			);
			const result = await updateAdminSlidingBannerSettings(undefined, {
				enabled: nextEnabled,
				messages: parsedMessages,
				messageDurationMs: normalizedDurationMs,
				desktopMessageCount,
			});

			if (!result.success || !result.settings) {
				throw new Error(result.error || "Failed to update banner status");
			}

			applySettings(result.settings, result.store);
			setStatusMessage(
				nextEnabled ? "Banner enabled and saved" : "Banner disabled and saved",
			);
		} catch (error) {
			setEnabled(!nextEnabled);
			setErrorMessage(
				error instanceof Error ? error.message : "Unknown toggle error",
			);
		} finally {
			setIsSaving(false);
		}
	}, [
		applySettings,
		desktopMessageCount,
		enabled,
		messageDurationSeconds,
		parsedMessages,
	]);

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<CardTitle>Sliding Banner</CardTitle>
						<CardDescription>
							Rotate focused messages with one slot on mobile and one or two on
							desktop.
						</CardDescription>
					</div>
					<Badge variant={enabled ? "default" : "outline"}>
						{enabled ? "Enabled" : "Disabled"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-3">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Active Messages
						</p>
						<p className="mt-1 text-sm font-medium">{parsedMessages.length}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Updated
						</p>
						<p className="mt-1 text-sm font-medium">
							{storeMeta?.updatedAt
								? new Date(storeMeta.updatedAt).toLocaleString()
								: "Never"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Store Location
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{storeMeta?.location || "Unavailable"}
						</p>
					</div>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="banner-duration">
							Display time per message (seconds)
						</Label>
						<Input
							id="banner-duration"
							type="number"
							step={0.1}
							min={1.8}
							max={12}
							value={messageDurationSeconds}
							onChange={(event) =>
								setMessageDurationSeconds(event.target.value)
							}
							disabled={isSaving || isRefreshing}
						/>
					</div>
					<div className="space-y-2">
						<Label>Desktop message slots</Label>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant={desktopMessageCount === 1 ? "default" : "outline"}
								disabled={isSaving || isRefreshing}
								onClick={() => setDesktopMessageCount(1)}
							>
								1 message
							</Button>
							<Button
								type="button"
								variant={desktopMessageCount === 2 ? "default" : "outline"}
								disabled={isSaving || isRefreshing}
								onClick={() => setDesktopMessageCount(2)}
							>
								2 messages
							</Button>
						</div>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="banner-messages">
						Messages (one per line, ordered top to bottom)
					</Label>
					<Textarea
						id="banner-messages"
						value={messagesInput}
						onChange={(event) => setMessagesInput(event.target.value)}
						disabled={isSaving || isRefreshing}
						rows={7}
						placeholder="Curated by Out Of Office Collective"
					/>
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant={enabled ? "outline" : "default"}
						disabled={isSaving || isRefreshing}
						onClick={handleToggleEnabled}
					>
						{enabled ? "Disable Banner" : "Enable Banner"}
					</Button>
					<Button
						type="button"
						onClick={handleSave}
						disabled={isSaving || isRefreshing}
					>
						{isSaving ? "Saving..." : "Save Banner Settings"}
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
