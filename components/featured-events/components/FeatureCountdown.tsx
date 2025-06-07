/**
 * FeatureCountdown Component - Simplified Version
 *
 * Shows status for all featured events without live updates for better performance.
 * Updates on page load/refresh only, which is sufficient for hourly precision.
 *
 * Benefits:
 * - No timers or intervals (better performance, battery life)
 * - Simple hourly precision (good enough for event management)
 * - Clean, maintainable code
 * - Still uses centralized timestamp utilities (DRY)
 * - Updates with SSR and client renders (NOT static at build time)
 */

"use client";

import React from "react";
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
		message:
			hoursRemaining > 24
				? `${Math.floor(hoursRemaining / 24)}d remaining`
				: `${hoursRemaining}h remaining`,
		endTime,
		hoursRemaining,
	};
}

/**
 * Event card with proper spacing and progress bar
 */
function SimpleEventCard({ eventStatus }: { eventStatus: EventStatus }) {
	const { event, status, message, endTime, hoursRemaining } = eventStatus;

	const getStatusConfig = () => {
		switch (status) {
			case "active-manual":
				return {
					emoji: "🌟",
					bgColor: "bg-green-50 dark:bg-green-950/20",
					borderColor: "border-green-200 dark:border-green-800",
					textColor: "text-green-600 dark:text-green-400",
					progressColor: "bg-gradient-to-r from-green-400 to-green-600",
				};
			case "active-timed":
				return {
					emoji: "✨",
					bgColor: "bg-blue-50 dark:bg-blue-950/20",
					borderColor: "border-blue-200 dark:border-blue-800",
					textColor: "text-blue-600 dark:text-blue-400",
					progressColor: "bg-gradient-to-r from-blue-400 to-blue-600",
				};
			case "expires-soon":
				return {
					emoji: "⚡",
					bgColor: "bg-orange-50 dark:bg-orange-950/20",
					borderColor: "border-orange-200 dark:border-orange-800",
					textColor: "text-orange-600 dark:text-orange-400",
					progressColor: "bg-gradient-to-r from-orange-400 to-red-500",
				};
			case "expired":
				return {
					emoji: "😴",
					bgColor: "bg-gray-50 dark:bg-gray-950/20",
					borderColor: "border-gray-200 dark:border-gray-800",
					textColor: "text-gray-600 dark:text-gray-400",
					progressColor: "bg-gray-400",
				};
		}
	};

	const config = getStatusConfig();

	// Calculate progress percentage for progress bar
	const getProgressPercentage = () => {
		if (status === "expired") return 100;
		if (status === "active-manual") return 100; // Full bar for manual events

		// For timed events, calculate based on 48-hour duration
		if (endTime && hoursRemaining !== undefined) {
			const totalHours = FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS;
			const elapsedHours = totalHours - hoursRemaining;
			return Math.min(100, Math.max(0, (elapsedHours / totalHours) * 100));
		}

		return 0;
	};

	const progressPercentage = getProgressPercentage();

	return (
		<div
			className={`border rounded-lg p-4 transition-all duration-300 hover:shadow-md ${config.bgColor} ${config.borderColor}`}
		>
			{/* Header with title and badge */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-sm flex items-center gap-2 mb-1">
						{config.emoji}
						<span className="truncate">{event.name}</span>
					</h4>
					<div className="flex items-center gap-2 text-xs">
						<Timer className="h-3 w-3" />
						<span className={config.textColor}>{message}</span>
					</div>
				</div>
				<Badge
					variant={status === "expired" ? "outline" : "secondary"}
					className={`flex items-center gap-1 text-xs flex-shrink-0 ml-2 ${
						status === "expired" ? "opacity-60" : ""
					}`}
				>
					<Star className="h-3 w-3" />
					Featured
				</Badge>
			</div>

			{/* Progress Bar */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-xs">
					<span className="text-muted-foreground">
						{status === "active-manual" ? "Status" : "Progress"}
					</span>
					<span className={`font-medium ${config.textColor}`}>
						{status === "active-manual"
							? "Active"
							: `${Math.round(progressPercentage)}%`}
					</span>
				</div>
				<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
					<div
						className={`h-2.5 rounded-full transition-all duration-500 ease-out ${config.progressColor}`}
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
			</div>

			{/* Show end time for expired events */}
			{status === "expired" && endTime && (
				<div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
					📅 Ended: {endTime.toLocaleDateString()} at{" "}
					{endTime.toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
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
