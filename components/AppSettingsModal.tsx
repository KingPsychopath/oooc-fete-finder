"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { useOptionalAuth } from "@/features/auth/auth-context";
import { trackMapPreferenceChange } from "@/features/events/engagement/client-tracking";
import { APP_PREFERENCES_EVENT_KEY } from "@/features/events/engagement/constants";
import { MAP_OPTIONS } from "@/features/maps/constants/map-options";
import { useMapPreference } from "@/features/maps/hooks/use-map-preference";
import {
	canSyncAccountData,
	getClientSyncMode,
} from "@/features/sync/client-sync-mode";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import { normalizeMapPreference } from "@/lib/user-app-settings";
import { cn } from "@/lib/utils";
import {
	BellOff,
	Filter,
	HardDrive,
	Map,
	MapPinned,
	Monitor,
	Moon,
	RefreshCcw,
	Search,
	Settings,
	Smartphone,
	Sun,
} from "lucide-react";
import { useEffect, useState } from "react";

interface AppSettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const themeOptions = [
	{ value: "system", label: "System", icon: Monitor },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
] as const;

const eventSortOptions = [
	{
		value: "upcoming",
		label: "Upcoming",
		description: "Use event timing after featured and promoted picks.",
	},
	{
		value: "fresh-activity",
		label: "Fresh activity",
		description: "Prioritize recently active regular events.",
	},
] as const;

const mapLoadOptions = [
	{
		value: "idle",
		label: "Faster opening",
		description: "Preload the live map after the page settles.",
	},
	{
		value: "expand",
		label: "Save data",
		description: "Load the live map only when you open it.",
	},
] as const;

function isDefaultEventSortMode(
	value: string | null,
): value is (typeof eventSortOptions)[number]["value"] {
	return value === "upcoming" || value === "fresh-activity";
}

function isUserMapLoadStrategy(
	value: string | null,
): value is (typeof mapLoadOptions)[number]["value"] {
	return value === "idle" || value === "expand";
}

export function AppSettingsModal({ isOpen, onClose }: AppSettingsModalProps) {
	const haptics = useAppHaptics();
	const { authMode, isAuthenticated, isOnline } = useOptionalAuth();
	const { theme, setTheme, mounted } = useThemeToggle();
	const {
		mapPreference,
		setMapPreference,
		isLoaded: isMapPreferenceLoaded,
	} = useMapPreference();
	const {
		settings,
		isLoaded: areLocalSettingsLoaded,
		setHideFloatingFilterButton,
		setHideFloatingPrompts,
		setEnableHaptics,
		setDefaultEventSortMode,
		setMapLoadStrategy,
		resetLocalAppSettings,
	} = useLocalAppSettings();
	const [isResetArmed, setIsResetArmed] = useState(false);

	const isReady = mounted && isMapPreferenceLoaded && areLocalSettingsLoaded;
	const selectedMapOption =
		MAP_OPTIONS.find((option) => option.id === mapPreference) ??
		MAP_OPTIONS.find((option) => option.id === "system");
	const selectedSortOption =
		eventSortOptions.find(
			(option) => option.value === settings.defaultEventSortMode,
		) ?? eventSortOptions[0];
	const selectedMapLoadOption =
		mapLoadOptions.find(
			(option) => option.value === settings.mapLoadStrategy,
		) ?? mapLoadOptions[0];
	const syncMode = getClientSyncMode({ authMode, isAuthenticated, isOnline });

	const handleMapPreferenceChange = (value: string | null) => {
		haptics.selection();
		const nextPreference = normalizeMapPreference(value);
		if (mapPreference !== nextPreference) {
			trackMapPreferenceChange({
				eventKey: APP_PREFERENCES_EVENT_KEY,
				from: mapPreference,
				to: nextPreference,
				source: "app_settings",
				isAuthenticated,
			});
		}
		setMapPreference(nextPreference);
	};

	const handleDefaultSortChange = (value: string | null) => {
		if (isDefaultEventSortMode(value)) {
			haptics.selection();
			setDefaultEventSortMode(value);
		}
	};

	const handleMapLoadStrategyChange = (value: string | null) => {
		if (isUserMapLoadStrategy(value)) {
			haptics.selection();
			setMapLoadStrategy(value);
		}
	};

	const handleResetSettings = () => {
		if (!isResetArmed) {
			haptics.warning();
			setIsResetArmed(true);
			return;
		}
		haptics.success();
		resetLocalAppSettings();
		setMapPreference("system");
		setTheme("system");
		setIsResetArmed(false);
	};

	useEffect(() => {
		if (!isResetArmed) return;
		const timeoutId = window.setTimeout(() => {
			setIsResetArmed(false);
		}, 6000);
		return () => window.clearTimeout(timeoutId);
	}, [isResetArmed]);

	useEffect(() => {
		if (isOpen) return;
		setIsResetArmed(false);
	}, [isOpen]);

	const preferenceToggleClassName =
		"flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/55 px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";
	const switchClassName =
		"relative h-6 w-11 shrink-0 rounded-full border border-border bg-muted transition-colors";
	const switchThumbClassName =
		"absolute top-0.5 left-0.5 size-4.5 rounded-full bg-background shadow-sm transition-transform";
	const syncStatusCopy = canSyncAccountData(syncMode)
		? "Synced to your account and kept on this device for offline use."
		: syncMode === "offline-grace"
			? "Saved on this device now; account sync resumes when your live session is online."
			: "Saved on this device and available offline.";

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="overflow-y-auto rounded-2xl border-border/80 bg-card/98 p-0 shadow-[0_28px_70px_-38px_rgba(6,4,2,0.78)] backdrop-blur-xl"
				style={{
					maxWidth:
						"min(38rem, calc(100dvw - max(env(safe-area-inset-left), 1rem) - max(env(safe-area-inset-right), 1rem)))",
				}}
			>
				<div className="border-b border-border/70 px-4 py-3">
					<DialogHeader>
						<p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							<Settings className="h-3.5 w-3.5" />
							Fete Finder
						</p>
						<DialogTitle className="mt-0.5 text-xl [font-family:var(--ooo-font-display)] font-light">
							App settings
						</DialogTitle>
					</DialogHeader>
				</div>

				<div className="space-y-4 px-4 py-3">
					<section className="space-y-2.5">
						<div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
							<Sun className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-medium">Appearance</h3>
						</div>
						<div className="grid grid-cols-3 gap-2">
							{themeOptions.map((option) => {
								const Icon = option.icon;
								const isSelected = theme === option.value;
								return (
									<Button
										key={option.value}
										type="button"
										variant={isSelected ? "default" : "outline"}
										disabled={!mounted}
										onClick={() => {
											haptics.selection();
											setTheme(option.value);
										}}
										className={cn(
											"h-9 rounded-xl text-xs",
											isSelected && "shadow-sm",
										)}
									>
										<Icon className="h-3.5 w-3.5" />
										{option.label}
									</Button>
								);
							})}
						</div>
					</section>

					<section className="space-y-2.5">
						<div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
							<MapPinned className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-medium">Map links</h3>
						</div>
						<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
							<p className="text-xs leading-relaxed text-muted-foreground">
								Used when you tap a venue or address from an event modal.
							</p>
							<Select
								value={mapPreference}
								onValueChange={handleMapPreferenceChange}
								disabled={!isMapPreferenceLoaded}
							>
								<SelectTrigger className="h-9 w-full rounded-xl bg-background/55">
									<span className="flex min-w-0 items-center gap-2 truncate">
										<span className="text-base leading-none">
											{selectedMapOption?.icon}
										</span>
										<span className="truncate">{selectedMapOption?.name}</span>
									</span>
								</SelectTrigger>
								<SelectContent>
									{MAP_OPTIONS.map((option) => (
										<SelectItem key={option.id} value={option.id}>
											<span className="text-base leading-none">
												{option.icon}
											</span>
											{option.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</section>

					<section className="space-y-2.5">
						<div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
							<Map className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-medium">Map loading</h3>
						</div>
						<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
							<p className="text-xs leading-relaxed text-muted-foreground">
								Choose when the live Paris map starts on this device.
							</p>
							<Select
								value={settings.mapLoadStrategy}
								onValueChange={handleMapLoadStrategyChange}
								disabled={!areLocalSettingsLoaded}
							>
								<SelectTrigger className="h-9 w-full rounded-xl bg-background/55">
									<span className="truncate">
										{selectedMapLoadOption.label}
									</span>
								</SelectTrigger>
								<SelectContent>
									{mapLoadOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<p className="text-xs leading-relaxed text-muted-foreground">
							{selectedMapLoadOption.description}
						</p>
					</section>

					<section className="space-y-2.5">
						<div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
							<Filter className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-medium">Discovery controls</h3>
						</div>
						<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
							<p className="text-xs leading-relaxed text-muted-foreground">
								Choose how the event list starts on this device.
							</p>
							<Select
								value={settings.defaultEventSortMode}
								onValueChange={handleDefaultSortChange}
								disabled={!areLocalSettingsLoaded}
							>
								<SelectTrigger className="h-9 w-full rounded-xl bg-background/55">
									<span className="truncate">{selectedSortOption.label}</span>
								</SelectTrigger>
								<SelectContent>
									{eventSortOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2 sm:grid-cols-2">
							<button
								type="button"
								disabled={!areLocalSettingsLoaded}
								onClick={() => {
									haptics.selection();
									setHideFloatingFilterButton(
										!settings.hideFloatingFilterButton,
									);
								}}
								className={cn(
									preferenceToggleClassName,
									settings.hideFloatingFilterButton &&
										"border-primary/45 bg-primary/10",
								)}
							>
								<span className="flex min-w-0 items-center gap-2.5">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80 text-muted-foreground">
										<Search className="h-4 w-4" />
									</span>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											Hide dock search and filters
										</span>
										<span className="mt-0.5 block text-xs leading-snug text-muted-foreground sm:hidden">
											Let the main nav use the full bottom bar.
										</span>
									</span>
								</span>
								<span
									className={cn(
										switchClassName,
										settings.hideFloatingFilterButton &&
											"border-primary bg-primary",
									)}
									aria-hidden="true"
								>
									<span
										className={cn(
											switchThumbClassName,
											settings.hideFloatingFilterButton && "translate-x-5",
										)}
									/>
								</span>
							</button>
							<button
								type="button"
								disabled={!areLocalSettingsLoaded}
								onClick={() => {
									haptics.selection();
									setHideFloatingPrompts(!settings.hideFloatingPrompts);
								}}
								className={cn(
									preferenceToggleClassName,
									settings.hideFloatingPrompts &&
										"border-primary/45 bg-primary/10",
								)}
							>
								<span className="flex min-w-0 items-center gap-2.5">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80 text-muted-foreground">
										<BellOff className="h-4 w-4" />
									</span>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											Hide support and install prompts
										</span>
										<span className="mt-0.5 block text-xs leading-snug text-muted-foreground sm:hidden">
											Suppresses support, PWA install, and community invite
											cards.
										</span>
									</span>
								</span>
								<span
									className={cn(
										switchClassName,
										settings.hideFloatingPrompts && "border-primary bg-primary",
									)}
									aria-hidden="true"
								>
									<span
										className={cn(
											switchThumbClassName,
											settings.hideFloatingPrompts && "translate-x-5",
										)}
									/>
								</span>
							</button>
						</div>
					</section>

					<section className="space-y-2.5">
						<div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
							<Smartphone className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-medium">Mobile feedback</h3>
						</div>
						<button
							type="button"
							disabled={!areLocalSettingsLoaded}
							onClick={() => {
								haptics.selection();
								setEnableHaptics(!settings.enableHaptics);
							}}
							className={cn(
								preferenceToggleClassName,
								settings.enableHaptics && "border-primary/45 bg-primary/10",
							)}
						>
							<span className="flex min-w-0 items-center gap-2.5">
								<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80 text-muted-foreground">
									<Smartphone className="h-4 w-4" />
								</span>
								<span className="min-w-0">
									<span className="block text-sm font-medium">
										Haptic feedback
									</span>
									<span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
										Use subtle vibration on supported mobile devices.
									</span>
								</span>
							</span>
							<span
								className={cn(
									switchClassName,
									settings.enableHaptics && "border-primary bg-primary",
								)}
								aria-hidden="true"
							>
								<span
									className={cn(
										switchThumbClassName,
										settings.enableHaptics && "translate-x-5",
									)}
								/>
							</span>
						</button>
						<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
							<p className="text-xs leading-relaxed text-muted-foreground">
								{haptics.isSupported
									? haptics.isCoarsePointer
										? "Supported on this device. Use the test button if you want to feel the pattern."
										: "Supported by this browser. Use the test button if you want to feel the pattern."
									: haptics.isCoarsePointer
										? "Using the WebHaptics touch fallback for this browser."
										: "Using the WebHaptics fallback when this browser supports it."}
							</p>
							<Button
								type="button"
								variant="outline"
								disabled={!haptics.canTrigger}
								onClick={() => haptics.success()}
								className="h-8 rounded-xl text-xs"
							>
								Test haptics
							</Button>
						</div>
					</section>

					<section className="space-y-2.5">
						<div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
							<HardDrive className="h-4 w-4 text-muted-foreground" />
							<h3 className="text-sm font-medium">Storage and sync</h3>
						</div>
						<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center">
							<p className="text-xs leading-relaxed text-muted-foreground">
								{syncStatusCopy}
							</p>
							<Button
								type="button"
								variant={isResetArmed ? "default" : "outline"}
								onClick={handleResetSettings}
								disabled={!isReady}
								className="h-9 w-full rounded-xl text-xs"
							>
								<RefreshCcw className="h-3.5 w-3.5" />
								{isResetArmed ? "Confirm reset" : "Reset local settings"}
							</Button>
						</div>
						{isResetArmed && (
							<p className="text-xs leading-relaxed text-muted-foreground">
								This resets theme, map links, prompts, filters, haptics, and
								default sort on this device.
							</p>
						)}
					</section>
				</div>

				<div className="border-t border-border/70 px-4 py-3">
					<Button
						type="button"
						onClick={() => {
							haptics.success();
							onClose();
						}}
						disabled={!isReady}
						className="h-9 w-full rounded-xl"
					>
						Done
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
