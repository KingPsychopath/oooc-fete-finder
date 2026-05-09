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
import { MAP_OPTIONS } from "@/features/maps/constants/map-options";
import { useMapPreference } from "@/features/maps/hooks/use-map-preference";
import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import { normalizeMapPreference } from "@/lib/user-app-settings";
import { cn } from "@/lib/utils";
import {
	BellOff,
	HardDrive,
	EyeOff,
	Filter,
	MapPinned,
	Monitor,
	Moon,
	RefreshCcw,
	Settings,
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

function isDefaultEventSortMode(
	value: string | null,
): value is (typeof eventSortOptions)[number]["value"] {
	return value === "upcoming" || value === "fresh-activity";
}

export function AppSettingsModal({ isOpen, onClose }: AppSettingsModalProps) {
	const { authMode, isAuthenticated, isOnline } = useOptionalAuth();
	const { theme, setTheme, mounted } = useThemeToggle();
	const { mapPreference, setMapPreference, isLoaded: isMapPreferenceLoaded } =
		useMapPreference();
	const {
		settings,
		isLoaded: areLocalSettingsLoaded,
		setHideFloatingFilterButton,
		setHideFloatingPrompts,
		setDefaultEventSortMode,
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

	const handleMapPreferenceChange = (value: string | null) => {
		setMapPreference(normalizeMapPreference(value));
	};

	const handleDefaultSortChange = (value: string | null) => {
		if (isDefaultEventSortMode(value)) {
			setDefaultEventSortMode(value);
		}
	};

	const handleResetSettings = () => {
		if (!isResetArmed) {
			setIsResetArmed(true);
			return;
		}
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
	const syncStatusCopy =
		isAuthenticated && authMode === "live" && isOnline
			? "Synced to your account and kept on this device for offline use."
			: isAuthenticated
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
										onClick={() => setTheme(option.value)}
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
											<span className="text-base leading-none">{option.icon}</span>
											{option.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
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
								onClick={() =>
									setHideFloatingFilterButton(
										!settings.hideFloatingFilterButton,
									)
								}
								className={cn(
									preferenceToggleClassName,
									settings.hideFloatingFilterButton &&
										"border-primary/45 bg-primary/10",
								)}
							>
								<span className="flex min-w-0 items-center gap-2.5">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/80 text-muted-foreground">
										<EyeOff className="h-4 w-4" />
									</span>
									<span className="min-w-0">
										<span className="block text-sm font-medium">
											Hide floating filter button
										</span>
										<span className="mt-0.5 block text-xs leading-snug text-muted-foreground sm:hidden">
											Filters still open from the Events section.
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
								onClick={() =>
									setHideFloatingPrompts(!settings.hideFloatingPrompts)
								}
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
											Suppresses support, PWA install, and community invite cards.
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
								This resets theme, map links, prompts, filters, and default sort
								on this device.
							</p>
						)}
					</section>
				</div>

				<div className="border-t border-border/70 px-4 py-3">
					<Button
						type="button"
						onClick={onClose}
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
