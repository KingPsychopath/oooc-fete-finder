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
 * - Future date detection and user warnings
 * - Uses centralized timestamp utilities (DRY)
 */

"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, Star, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FEATURED_EVENTS_CONFIG } from "../constants";
import {
	isValidTimestamp,
	isFeaturedEventExpired,
	getFeaturedEventExpirationDate,
} from "../utils/timestamp-utils";
import type { Event } from "@/types/events";
import { isDev } from "@/lib/config/env";

type FeatureCountdownProps = {
	featuredEvents: Event[];
};

type EventStatus = {
	event: Event;
	status: "active-manual" | "active-timed" | "expires-soon" | "expired";
	message: string;
	endTime?: Date | null;
	hoursRemaining?: number;
};

/**
 * Calculate simple status without complex time formatting
 * This runs fresh on every render (SSR, client render, refresh)
 */
function getEventStatus(event: Event): EventStatus {
	// Manual featured events (no timestamp)
	if (!isValidTimestamp(event.featuredAt)) {
		return {
			event,
			status: "active-manual",
			message: "Currently featured",
		};
	}

	// Timestamp-based events - using centralized utilities
	const isExpired = isFeaturedEventExpired(event.featuredAt);
	const endTime = getFeaturedEventExpirationDate(event.featuredAt);

	if (isExpired) {
		// Calculate time since expiration (runs fresh each render)
		const hoursAgo = endTime
			? Math.floor((Date.now() - endTime.getTime()) / (1000 * 60 * 60))
			: 0;
		return {
			event,
			status: "expired",
			message:
				hoursAgo < 24
					? `Ended ${hoursAgo}h ago`
					: `Ended ${Math.floor(hoursAgo / 24)}d ago`,
			endTime,
		};
	}

	// Active with time remaining (calculated fresh each render)
	const hoursRemaining = endTime
		? Math.floor((endTime.getTime() - Date.now()) / (1000 * 60 * 60))
		: 0;
	const status = hoursRemaining <= 6 ? "expires-soon" : "active-timed";

	return {
		event,
		status,
		message: `${hoursRemaining}h remaining`,
		endTime,
		hoursRemaining,
	};
}

/**
 * Event card with proper spacing and progress bar
 */
function SimpleEventCard({ eventStatus }: { eventStatus: EventStatus }) {
	const { event, endTime } = eventStatus;

	// Use state to handle hydration consistency
	const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

	// Update time after hydration to avoid mismatch
	useEffect(() => {
		setCurrentTime(new Date());

		// Set up interval for live updates after hydration
		const interval = setInterval(() => {
			setCurrentTime(new Date());
		}, 60000); // Update every minute

		return () => clearInterval(interval);
	}, []);

	// Calculate live status and message based on current time
	const getLiveStatus = () => {
		// Manual featured events (no timestamp)
		if (!isValidTimestamp(event.featuredAt)) {
			return {
				status: "active-manual",
				message: "Currently featured",
			};
		}

		// Check if expired using current time
		const isExpired = endTime && currentTime > endTime;

		if (isExpired) {
			const hoursAgo = endTime
				? Math.floor(
						(currentTime.getTime() - endTime.getTime()) / (1000 * 60 * 60),
					)
				: 0;
			return {
				status: "expired",
				message:
					hoursAgo < 24
						? `Ended ${hoursAgo}h ago`
						: `Ended ${Math.floor(hoursAgo / 24)}d ago`,
			};
		}

		// Active with time remaining
		const hoursRemaining = endTime
			? Math.floor(
					(endTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60),
				)
			: 0;
		const liveStatus = hoursRemaining <= 6 ? "expires-soon" : "active-timed";

		return {
			status: liveStatus,
			message: `${Math.max(0, hoursRemaining)}h remaining`,
		};
	};

	const { status: liveStatus, message } = getLiveStatus();

	const getStatusConfig = () => {
		switch (liveStatus) {
			case "active-manual":
				return {
					emoji: "🌟",
					bgColor: "bg-green-50 dark:bg-green-950/20",
					borderColor: "border-green-200 dark:border-green-800",
					textColor: "text-green-600 dark:text-green-400",
					progressColor:
						"bg-gradient-to-r from-emerald-400 via-green-500 to-green-600",
				};
			case "active-timed":
				return {
					emoji: "✨",
					bgColor: "bg-blue-50 dark:bg-blue-950/20",
					borderColor: "border-blue-200 dark:border-blue-800",
					textColor: "text-blue-600 dark:text-blue-400",
					progressColor:
						"bg-gradient-to-r from-cyan-400 via-blue-500 to-blue-600",
				};
			case "expires-soon":
				return {
					emoji: "⚡",
					bgColor: "bg-orange-50 dark:bg-orange-950/20",
					borderColor: "border-orange-200 dark:border-orange-800",
					textColor: "text-orange-600 dark:text-orange-400",
					progressColor:
						"bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500",
				};
			case "expired":
				return {
					emoji: "😴",
					bgColor: "bg-gray-50 dark:bg-gray-950/20",
					borderColor: "border-gray-200 dark:border-gray-800",
					textColor: "text-gray-600 dark:text-gray-400",
					progressColor: "bg-gradient-to-r from-gray-300 to-gray-500",
				};
			default:
				return {
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
			if (isDev()) {
				const totalHours = FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS;
				const elapsedHours = elapsedDuration / (1000 * 60 * 60);
				console.log(`📊 Progress for "${event.name}":`, {
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
			className={`border rounded-lg p-4 transition-all duration-300 hover:shadow-md w-full min-w-0 ${config.bgColor} ${config.borderColor}`}
		>
			{/* Header with title and badge */}
			<div className="flex items-start justify-between mb-3 gap-2">
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-sm flex items-center gap-2 mb-1">
						{config.emoji}
						<span className="truncate">{event.name}</span>
					</h4>
					<div className="flex items-center gap-2 text-xs">
						<Timer className="h-3 w-3 flex-shrink-0" />
						<span className={`${config.textColor} truncate`}>{message}</span>
					</div>
				</div>
				<Badge
					variant={liveStatus === "expired" ? "outline" : "secondary"}
					className={`flex items-center gap-1 text-xs flex-shrink-0 ${
						liveStatus === "expired" ? "opacity-60" : ""
					}`}
				>
					<Star className="h-3 w-3" />
					<span className="hidden sm:inline">Featured</span>
					<span className="sm:hidden">⭐</span>
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

			{/* Show future date correction warning */}
			{(() => {
				// Check if the featuredAt timestamp was originally a future date
				// by comparing if the featuredAt is very close to currentTime (indicating auto-correction)
				if (!event.featuredAt || !isValidTimestamp(event.featuredAt))
					return null;

				const featuredAtTime = new Date(event.featuredAt);
				const timeDiff = Math.abs(
					currentTime.getTime() - featuredAtTime.getTime(),
				);

				// If the featuredAt time is within 5 minutes of current time, it might be auto-corrected
				// This is a heuristic - if featuring started very recently, it might have been a future date
				const isLikelyAutoCorrected = timeDiff < 5 * 60 * 1000; // 5 minutes in milliseconds

				return (
					isLikelyAutoCorrected && (
						<div className="text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 mt-2 p-2 rounded border border-amber-200 dark:border-amber-800">
							<div className="flex items-start gap-1">
								<span className="text-amber-600 dark:text-amber-400 flex-shrink-0">
									⚠️
								</span>
								<div>
									<div className="font-medium">
										Recent feature start detected
									</div>
									<div className="text-xs mt-0.5">
										This event started featuring very recently. If you used a
										future date in your spreadsheet, it was automatically
										corrected to start immediately. Please verify your
										"Featured" column timestamp.
									</div>
								</div>
							</div>
						</div>
					)
				);
			})()}

			{/* Show end time for expired events */}
			{liveStatus === "expired" && endTime && (
				<div className="text-xs text-muted-foreground mt-2 pt-2 border-t break-words">
					📅 Ended:{" "}
					<span className="whitespace-nowrap">
						{endTime.toLocaleDateString("en-GB", {
							year: "numeric",
							month: "2-digit",
							day: "2-digit",
						})}
					</span>{" "}
					at{" "}
					<span className="whitespace-nowrap">
						{endTime.toLocaleTimeString("en-GB", {
							hour: "2-digit",
							minute: "2-digit",
						})}
					</span>
				</div>
			)}
		</div>
	);
}

export function FeatureCountdown({ featuredEvents }: FeatureCountdownProps) {
	// Simple calculation on render - no memoization needed
	// This runs fresh each time: SSR, client render, page refresh
	const eventStatuses = featuredEvents.map(getEventStatus);

	const activeEvents = eventStatuses.filter(
		(s) => s.status.startsWith("active") || s.status === "expires-soon",
	);
	const expiredEvents = eventStatuses.filter((s) => s.status === "expired");

	// Only show expired events from last 48 hours (calculated fresh each render)
	const recentExpiredEvents = expiredEvents.filter((s) => {
		if (!s.endTime) return false;
		const hoursAgo = (Date.now() - s.endTime.getTime()) / (1000 * 60 * 60);
		return hoursAgo <= 48;
	});

	// Don't render component if there are 0 active and 0 recent events
	if (activeEvents.length === 0 && recentExpiredEvents.length === 0) {
		return null;
	}

	// If no featured events, show setup instructions
	if (featuredEvents.length === 0) {
		return (
			<Card className="mb-8 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-yellow-600" />
						No Featured Events
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
						No events currently featured
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						Events can be featured for{" "}
						{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Clock className="h-5 w-5 text-blue-600" />
					Featured Events Status
					<Badge variant="outline" className="ml-auto">
						{activeEvents.length} active • {recentExpiredEvents.length} recent
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{/* Show message when no active events but some recent expired */}
					{activeEvents.length === 0 && recentExpiredEvents.length > 0 && (
						<div className="text-center py-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
							<div className="text-yellow-700 dark:text-yellow-300 text-sm font-medium mb-1">
								⏰ All featured events have ended
							</div>
							<div className="text-xs text-muted-foreground">
								Check recently ended events below or feature new events
							</div>
						</div>
					)}

					{/* Active Events */}
					{activeEvents.length > 0 && (
						<div>
							<h5 className="text-sm font-medium text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
								✨ Currently Featured ({activeEvents.length})
							</h5>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{activeEvents.map((status) => (
									<SimpleEventCard key={status.event.id} eventStatus={status} />
								))}
							</div>
						</div>
					)}

					{/* Expired Events */}
					{recentExpiredEvents.length > 0 && (
						<div>
							<h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
								⏰ Recently Ended ({recentExpiredEvents.length})
							</h5>
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{recentExpiredEvents.map((status) => (
									<SimpleEventCard key={status.event.id} eventStatus={status} />
								))}
							</div>
						</div>
					)}

					{/* Summary Info */}
					<div className="text-xs text-muted-foreground pt-3 border-t space-y-1">
						<div className="flex items-center justify-between">
							<span>
								⏱️ Feature duration:{" "}
								{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours • 🔄
								Refresh page for updates
							</span>
							{activeEvents.length > 0 && (
								<span className="text-green-600 dark:text-green-400 font-medium">
									{activeEvents.length} live
								</span>
							)}
						</div>
						{recentExpiredEvents.length > 0 && (
							<div className="text-gray-500">
								🧹 Expired events auto-hide after 48 hours to keep this list
								clean
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
