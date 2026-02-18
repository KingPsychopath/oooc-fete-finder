/**
 * FeatureCountdown Component - Live Updates Version
 *
 * Shows real-time status for all featured events with live countdown updates.
 * Updates every minute for accurate progress tracking and time remaining.
 *
 * Features:
 * - Live timers with 60-second intervals for real-time updates
 * - Dynamic progress bars showing actual elapsed time
 * - Automatic status transitions (active → expires-soon → expired)
 * - Hydration-safe rendering with suppressHydrationWarning
 * - Uses centralized timestamp utilities (DRY)
 */

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientLog } from "@/lib/platform/client-logger";
// Note: Using process.env.NODE_ENV directly to avoid server-side env variable access on client
import type { Event } from "@/features/events/types";
import { AlertCircle, Clock, Star, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { FEATURED_EVENTS_CONFIG } from "../constants";
import {
	getFeaturedEventExpirationDate,
	isFeaturedEventExpired,
	isValidTimestamp,
} from "../utils/timestamp-utils";

const FEATURE_COUNTDOWN_VARIANTS = ["default", "editorial"] as const;
type FeatureCountdownVariant = (typeof FEATURE_COUNTDOWN_VARIANTS)[number];

type FeatureCountdownProps = {
	featuredEvents: Event[];
	/** Use "editorial" on feature-event page for muted, emoji-free styling */
	variant?: FeatureCountdownVariant;
	/** Server-rendered timestamp to keep first client render hydration-safe */
	initialNowIso?: string;
};

type EventStatus = {
	event: Event;
	status: "active-manual" | "active-timed" | "expires-soon" | "expired";
	message: string;
	endTime?: Date | null;
};

const PARIS_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	timeZone: FEATURED_EVENTS_CONFIG.TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

const PARIS_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	timeZone: FEATURED_EVENTS_CONFIG.TIMEZONE,
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

const parseInitialNow = (initialNowIso?: string): Date => {
	if (!initialNowIso) return new Date();
	const parsed = new Date(initialNowIso);
	return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatRemainingMessage = (remainingMs: number): string => {
	const clampedMs = Math.max(0, remainingMs);
	const totalMinutes = Math.floor(clampedMs / (1000 * 60));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours <= 0) {
		return `${minutes}m remaining`;
	}
	return `${hours}h ${minutes}m remaining`;
};

const formatEndedMessage = (elapsedMs: number): string => {
	const clampedMs = Math.max(0, elapsedMs);
	const totalMinutes = Math.floor(clampedMs / (1000 * 60));
	const hours = Math.floor(totalMinutes / 60);
	const days = Math.floor(hours / 24);
	const minutes = totalMinutes % 60;
	const remainingHours = hours % 24;

	if (days > 0) {
		return `Ended ${days}d ${remainingHours}h ago`;
	}
	if (hours > 0) {
		return `Ended ${hours}h ${minutes}m ago`;
	}
	return `Ended ${minutes}m ago`;
};

const formatEndTimeInParis = (date: Date) => {
	return {
		dateLabel: PARIS_DATE_FORMATTER.format(date),
		timeLabel: PARIS_TIME_FORMATTER.format(date),
	};
};

/**
 * Calculate simple status without complex time formatting
 * This runs fresh on every render (SSR, client render, refresh)
 */
function getEventStatus(event: Event, now: Date): EventStatus {
	// Manual featured events (no timestamp)
	if (!isValidTimestamp(event.featuredAt)) {
		return {
			event,
			status: "active-manual",
			message: "Currently featured",
		};
	}

	// Timestamp-based events - using centralized utilities
	const isExpired = isFeaturedEventExpired(
		event.featuredAt,
		FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS,
		event.featuredEndsAt,
	);
	const endTime = getFeaturedEventExpirationDate(
		event.featuredAt,
		FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS,
		event.featuredEndsAt,
	);

	if (isExpired) {
		const elapsedMs = endTime ? now.getTime() - endTime.getTime() : 0;
		return {
			event,
			status: "expired",
			message: formatEndedMessage(elapsedMs),
			endTime,
		};
	}

	// Active with time remaining
	const remainingMs = endTime ? endTime.getTime() - now.getTime() : 0;
	const status =
		remainingMs <= 6 * 60 * 60 * 1000 ? "expires-soon" : "active-timed";

	return {
		event,
		status,
		message: formatRemainingMessage(remainingMs),
		endTime,
	};
}

/**
 * Event card with proper spacing and progress bar.
 * When variant is "editorial", uses muted colours and no emojis.
 */
function SimpleEventCard({
	eventStatus,
	currentTime,
	variant = "default",
}: {
	eventStatus: EventStatus;
	currentTime: Date;
	variant?: FeatureCountdownVariant;
}) {
	const { event, endTime, message, status: liveStatus } = eventStatus;
	const isEditorial = variant === "editorial";

	const getStatusConfig = () => {
		const editorial = {
			bgColor: "bg-muted/50",
			borderColor: "border-border",
			textColor: "text-muted-foreground",
			progressColor: "bg-foreground/25",
		};
		switch (liveStatus) {
			case "active-manual":
				return isEditorial
					? { emoji: "", ...editorial }
					: {
							emoji: "🌟",
							bgColor: "bg-green-50 dark:bg-green-950/20",
							borderColor: "border-green-200 dark:border-green-800",
							textColor: "text-green-600 dark:text-green-400",
							progressColor:
								"bg-gradient-to-r from-emerald-400 via-green-500 to-green-600",
						};
			case "active-timed":
				return isEditorial
					? { emoji: "", ...editorial }
					: {
							emoji: "✨",
							bgColor: "bg-blue-50 dark:bg-blue-950/20",
							borderColor: "border-blue-200 dark:border-blue-800",
							textColor: "text-blue-600 dark:text-blue-400",
							progressColor:
								"bg-gradient-to-r from-cyan-400 via-blue-500 to-blue-600",
						};
			case "expires-soon":
				return isEditorial
					? { emoji: "", ...editorial }
					: {
							emoji: "⚡",
							bgColor: "bg-orange-50 dark:bg-orange-950/20",
							borderColor: "border-orange-200 dark:border-orange-800",
							textColor: "text-orange-600 dark:text-orange-400",
							progressColor:
								"bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500",
						};
			case "expired":
				return isEditorial
					? { emoji: "", ...editorial }
					: {
							emoji: "😴",
							bgColor: "bg-gray-50 dark:bg-gray-950/20",
							borderColor: "border-gray-200 dark:border-gray-800",
							textColor: "text-gray-600 dark:text-gray-400",
							progressColor: "bg-gradient-to-r from-gray-300 to-gray-500",
						};
			default:
				return isEditorial
					? { emoji: "", ...editorial }
					: {
							emoji: "✨",
							bgColor: "bg-blue-50 dark:bg-blue-950/20",
							borderColor: "border-blue-200 dark:border-blue-800",
							textColor: "text-blue-600 dark:text-blue-400",
							progressColor:
								"bg-gradient-to-r from-cyan-400 via-blue-500 to-blue-600",
						};
		}
	};

	const config = getStatusConfig();

	const getProgressPercentage = () => {
		if (liveStatus === "expired") return 100;
		if (liveStatus === "active-manual") return 100; // Full bar for manual events

		// For timed events, calculate based on actual timestamps for maximum accuracy
		if (endTime && event.featuredAt && isValidTimestamp(event.featuredAt)) {
			const startTime = new Date(event.featuredAt);
			// Use consistent currentTime to avoid hydration mismatch
			const now = currentTime;

			const totalDuration = endTime.getTime() - startTime.getTime(); // Total feature duration in milliseconds
			const elapsedDuration = now.getTime() - startTime.getTime(); // Time elapsed since start

			// Calculate percentage based on actual time elapsed vs total duration
			const percentage = Math.min(
				100,
				Math.max(0, (elapsedDuration / totalDuration) * 100),
			);

			// Debug logging for progress bar accuracy
			if (process.env.NODE_ENV === "development") {
				const totalHours = FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS;
				const elapsedHours = elapsedDuration / (1000 * 60 * 60);
				clientLog.info("events.featured", "Progress", {
					eventName: event.name,
					startTime: startTime.toISOString(),
					endTime: endTime.toISOString(),
					now: now.toISOString(),
					totalHours,
					elapsedHours: Math.round(elapsedHours * 100) / 100,
					percentage: Math.round(percentage * 100) / 100,
				});
			}

			return percentage;
		}

		return 0;
	};

	const progressPercentage = getProgressPercentage();

	return (
		<div
			className={`border rounded-lg p-4 transition-all duration-300 w-full min-w-0 ${config.bgColor} ${config.borderColor} ${!isEditorial ? "hover:shadow-md" : ""}`}
		>
			<div className="flex items-start justify-between mb-3 gap-2">
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-sm flex items-center gap-2 mb-1">
						{config.emoji ? <span>{config.emoji}</span> : null}
						<span className="truncate">{event.name}</span>
					</h4>
					<div className="flex items-center gap-2 text-xs">
						<Timer className="h-3 w-3 flex-shrink-0" />
						<span className={`${config.textColor} truncate`}>{message}</span>
					</div>
				</div>
				<Badge
					variant={liveStatus === "expired" ? "outline" : "secondary"}
					className={`flex items-center gap-1 text-xs flex-shrink-0 font-normal ${
						liveStatus === "expired" ? "opacity-60" : ""
					}`}
				>
					<Star className="h-3 w-3" />
					<span className="hidden sm:inline">Featured</span>
					{!isEditorial && <span className="sm:hidden">⭐</span>}
					{isEditorial && <span className="sm:hidden">Featured</span>}
				</Badge>
			</div>

			{/* Progress Bar */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-xs gap-2">
					<span className="text-muted-foreground flex-shrink-0">
						{liveStatus === "active-manual" ? "Status" : "Progress"}
					</span>
					<span className={`font-medium ${config.textColor} flex-shrink-0`}>
						{liveStatus === "active-manual"
							? "Active"
							: `${Math.round(progressPercentage)}%`}
					</span>
				</div>
				<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
					<div
						className={`h-2.5 rounded-full transition-all duration-500 ease-out ${config.progressColor}`}
						style={{ width: `${progressPercentage}%` }}
						suppressHydrationWarning={true}
					/>
				</div>
			</div>

			{/* Show end time for expired events */}
			{liveStatus === "expired" && endTime && (
				<div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border break-words">
					{isEditorial ? "Ended: " : "📅 Ended: "}
					<span className="whitespace-nowrap">
						{formatEndTimeInParis(endTime).dateLabel}
					</span>{" "}
					at{" "}
					<span className="whitespace-nowrap">
						{formatEndTimeInParis(endTime).timeLabel}
					</span>{" "}
					<span className="whitespace-nowrap text-[11px]">
						({FEATURED_EVENTS_CONFIG.TIMEZONE})
					</span>
				</div>
			)}
		</div>
	);
}

export function FeatureCountdown({
	featuredEvents,
	variant = "default",
	initialNowIso,
}: FeatureCountdownProps) {
	const [currentTime, setCurrentTime] = useState<Date>(() =>
		parseInitialNow(initialNowIso),
	);
	const eventStatuses = featuredEvents.map((event) =>
		getEventStatus(event, currentTime),
	);
	const isEditorial = variant === "editorial";

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);
		return () => clearInterval(interval);
	}, []);

	const activeEvents = eventStatuses.filter(
		(s) => s.status.startsWith("active") || s.status === "expires-soon",
	);
	const expiredEvents = eventStatuses.filter((s) => s.status === "expired");

	const recentExpiredEvents = expiredEvents.filter((s) => {
		if (!s.endTime) return false;
		const hoursAgo =
			(currentTime.getTime() - s.endTime.getTime()) / (1000 * 60 * 60);
		return hoursAgo <= 48;
	});

	if (activeEvents.length === 0 && recentExpiredEvents.length === 0) {
		return null;
	}

	if (featuredEvents.length === 0) {
		const cardClass = isEditorial
			? "mb-8 border border-border bg-card"
			: "mb-8 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800";
		return (
			<Card className={cardClass}>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						{!isEditorial && (
							<AlertCircle className="h-5 w-5 text-yellow-600" />
						)}
						No featured events
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p
						className={
							isEditorial
								? "text-foreground font-medium"
								: "text-lg font-semibold text-yellow-700 dark:text-yellow-300"
						}
					>
						No events currently featured
					</p>
					<p className="text-sm text-muted-foreground mt-1">
						Events can be featured for{" "}
						{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
					</p>
				</CardContent>
			</Card>
		);
	}

	const statusCardClass = isEditorial
		? "mb-8 border border-border bg-card"
		: "mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800";

	return (
		<Card className={statusCardClass}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{!isEditorial && <Clock className="h-5 w-5 text-blue-600" />}
					Featured events status
					<Badge variant="outline" className="ml-auto font-normal">
						{activeEvents.length} active · {recentExpiredEvents.length} recent
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{activeEvents.length === 0 && recentExpiredEvents.length > 0 && (
						<div
							className={
								isEditorial
									? "text-center py-4 bg-muted/30 rounded-lg border border-border text-sm text-muted-foreground"
									: "text-center py-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
							}
						>
							<div
								className={
									isEditorial
										? "text-foreground font-medium mb-1"
										: "text-yellow-700 dark:text-yellow-300 text-sm font-medium mb-1"
								}
							>
								{isEditorial ? "" : "⏰ "}All featured events have ended
							</div>
							<div className="text-xs text-muted-foreground">
								Check recently ended events below or feature new events
							</div>
						</div>
					)}

					{activeEvents.length > 0 && (
						<div>
							<h5
								className={
									isEditorial
										? "text-sm font-medium text-foreground mb-3"
										: "text-sm font-medium text-green-700 dark:text-green-300 mb-3 flex items-center gap-2"
								}
							>
								{!isEditorial && "✨ "}Currently featured ({activeEvents.length}
								)
							</h5>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{activeEvents.map((status) => (
									<SimpleEventCard
										key={status.event.id}
										eventStatus={status}
										currentTime={currentTime}
										variant={variant}
									/>
								))}
							</div>
						</div>
					)}

					{recentExpiredEvents.length > 0 && (
						<div>
							<h5
								className={
									isEditorial
										? "text-sm font-medium text-muted-foreground mb-3"
										: "text-sm font-medium text-gray-600 dark:text-gray-400 mb-3"
								}
							>
								{!isEditorial && "⏰ "}Recently ended (
								{recentExpiredEvents.length})
							</h5>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{recentExpiredEvents.map((status) => (
									<SimpleEventCard
										key={status.event.id}
										eventStatus={status}
										currentTime={currentTime}
										variant={variant}
									/>
								))}
							</div>
						</div>
					)}

					<div className="text-xs text-muted-foreground pt-3 border-t border-border space-y-1">
						<div className="flex items-center justify-between">
							<span>
								{!isEditorial && "⏱️ "}Feature duration:{" "}
								{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
								{!isEditorial && " · 🔄 Refresh page for updates"}
							</span>
							{activeEvents.length > 0 && (
								<span
									className={
										isEditorial
											? "font-medium"
											: "text-green-600 dark:text-green-400 font-medium"
									}
								>
									{activeEvents.length} live
								</span>
							)}
						</div>
						{recentExpiredEvents.length > 0 && (
							<div>
								{!isEditorial && "🧹 "}Expired events auto-hide after 48 hours
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
