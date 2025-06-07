/**
 * Feature Countdown Component
 * 
 * This component shows individual countdown progress bars for each featured event.
 * Each event displays its remaining feature time with a visual progress indicator.
 * 
 * ALTERNATIVE APPROACH (simpler):
 * If you don't want to manage timestamps in your spreadsheet, you could implement
 * a fixed rotation schedule instead. For example:
 * - Events rotate every day at 12:00 PM
 * - Or every Monday, Wednesday, Friday at specific times
 * - The countdown would show time until the next fixed rotation
 * 
 * To implement fixed rotation:
 * 1. Remove the featuredAt timestamp logic
 * 2. Calculate next rotation time based on a fixed schedule
 * 3. Use that as the countdown target
 */

"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, Star, Timer } from "lucide-react";
import { FEATURED_EVENTS_CONFIG } from "../constants";
import { 
	isValidTimestamp, 
	isFeaturedEventExpired, 
	getFeaturedEventExpirationDate 
} from "../utils/timestamp-utils";
import type { Event } from "@/types/events";
import { Badge } from "@/components/ui/badge";

type FeatureCountdownProps = {
	featuredEvents: Event[];
};

type EventTimeStatus = {
	event: Event;
	timeRemaining: string;
	isExpired: boolean;
	progressPercentage: number;
	endTime: Date | null;
	hoursExpired?: number; // How many hours ago the feature period ended
};

/**
 * Calculate time status for a single featured event using centralized utilities
 */
function calculateEventTimeStatus(event: Event): EventTimeStatus {
	const now = new Date();
	
	// If no featuredAt timestamp or invalid timestamp, treat as currently featured without countdown
	if (!isValidTimestamp(event.featuredAt)) {
		return {
			event,
			timeRemaining: `Featured for ${FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours`,
			isExpired: false,
			progressPercentage: 0,
			endTime: null,
		};
	}

	// Use centralized utility to check if expired
	const isExpired = isFeaturedEventExpired(event.featuredAt);
	const endTime = getFeaturedEventExpirationDate(event.featuredAt);
	
	if (!endTime) {
		// This shouldn't happen if isValidTimestamp passed, but handle gracefully
		return {
			event,
			timeRemaining: `Featured for ${FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours`,
			isExpired: false,
			progressPercentage: 0,
			endTime: null,
		};
	}

	if (isExpired) {
		const timeSinceExpired = now.getTime() - endTime.getTime();
		const hoursExpired = Math.floor(timeSinceExpired / (1000 * 60 * 60));
		const daysExpired = Math.floor(hoursExpired / 24);
		
		let expiredTimeText: string;
		if (daysExpired > 0) {
			expiredTimeText = `Ended ${daysExpired} day${daysExpired > 1 ? 's' : ''} ago`;
		} else if (hoursExpired > 0) {
			expiredTimeText = `Ended ${hoursExpired} hour${hoursExpired > 1 ? 's' : ''} ago`;
		} else {
			expiredTimeText = "Ended recently";
		}

		return {
			event,
			timeRemaining: expiredTimeText,
			isExpired: true,
			progressPercentage: 100,
			endTime,
			hoursExpired,
		};
	}

	// Calculate progress and remaining time
	const featuredAt = new Date(event.featuredAt as string);
	const totalDuration = FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS * 60 * 60 * 1000;
	const timeElapsed = now.getTime() - featuredAt.getTime();
	const timeRemaining = endTime.getTime() - now.getTime();
	
	const progressPercentage = Math.min(100, Math.max(0, (timeElapsed / totalDuration) * 100));

	// Format remaining time
	const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
	const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

	let formattedTime: string;
	if (hours > 0) {
		formattedTime = `${hours}h ${minutes}m remaining`;
	} else {
		formattedTime = `${minutes}m remaining`;
	}

	return {
		event,
		timeRemaining: formattedTime,
		isExpired: false,
		progressPercentage,
		endTime,
	};
}

/**
 * Individual event countdown card component
 */
function EventCountdownCard({ eventStatus }: { eventStatus: EventTimeStatus }) {
	const { event, timeRemaining, isExpired, progressPercentage, endTime } = eventStatus;

	const cardBgClass = isExpired 
		? "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border-gray-300 dark:border-gray-700"
		: !endTime 
			? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800"
			: progressPercentage > 75 
				? "bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200 dark:border-orange-800"
				: "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800";

	return (
		<div className={`border rounded-lg p-4 transition-all duration-300 hover:shadow-md ${cardBgClass}`}>
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1">
					<h4 className="font-semibold text-sm line-clamp-1 mb-1 flex items-center gap-2">
						{isExpired 
							? "😴" 
							: !endTime 
								? "🌟" 
								: progressPercentage > 85 
									? "🔥" 
									: progressPercentage > 60 
										? "⚡" 
										: "✨"
						}
						{event.name}
					</h4>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Timer className="h-3 w-3" />
						<span className={
							isExpired 
								? "text-gray-600 dark:text-gray-400" 
								: !endTime 
									? "text-green-600 dark:text-green-400"
									: "text-blue-600 dark:text-blue-400"
						}>
							{timeRemaining}
						</span>
					</div>
					{/* Show end time for expired events */}
					{isExpired && endTime && (
						<div className="text-xs text-muted-foreground mt-1">
							📅 Ended: {endTime.toLocaleDateString()} at {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
						</div>
					)}
				</div>
				<Badge 
					variant={isExpired ? "outline" : "secondary"} 
					className={`flex items-center gap-1 text-xs ${
						isExpired ? "opacity-60" : ""
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
						{endTime ? "Feature Progress" : "Feature Status"}
					</span>
					<span className={`font-medium ${
						isExpired 
							? "text-red-600 dark:text-red-400" 
							: !endTime 
								? "text-green-600 dark:text-green-400"
								: "text-blue-600 dark:text-blue-400"
					}`}>
						{endTime ? `${Math.round(progressPercentage)}%` : "Active"}
					</span>
				</div>
				<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
					<div
						className={`h-2.5 rounded-full transition-all duration-500 ease-out relative ${
							isExpired 
								? "bg-red-500" 
								: !endTime 
									? "bg-gradient-to-r from-green-400 to-blue-500" 
									: progressPercentage > 85 
										? "bg-gradient-to-r from-red-400 to-red-600" 
										: progressPercentage > 60 
											? "bg-gradient-to-r from-orange-400 to-red-500" 
											: "bg-gradient-to-r from-blue-400 to-purple-600"
						}`}
						style={{ width: `${endTime ? progressPercentage : 100}%` }}
					>
						{/* Cute shimmer effect for active progress bars */}
						{!isExpired && (
							<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function FeatureCountdown({ featuredEvents }: FeatureCountdownProps) {
	// State for live updates
	const [updateTrigger, setUpdateTrigger] = useState(0);
	// State for showing/hiding expired events
	const [showExpired, setShowExpired] = useState(true);

	// Update every minute for live countdowns
	useEffect(() => {
		const interval = setInterval(() => {
			setUpdateTrigger(prev => prev + 1);
		}, 60000); // Update every minute

		return () => clearInterval(interval);
	}, []);

	// Calculate status for all featured events (will recalculate when updateTrigger changes)
	const eventStatuses = React.useMemo(() => {
		// Include updateTrigger to force recalculation
		return featuredEvents.map(calculateEventTimeStatus);
	}, [featuredEvents, updateTrigger]);
	
	const activeEvents = eventStatuses.filter(status => !status.isExpired);
	// Only show expired events from the last 48 hours to prevent bloat
	const recentExpiredEvents = eventStatuses.filter(status => 
		status.isExpired && (status.hoursExpired ?? 0) <= 48
	);
	const expiredEventsToShow = showExpired ? recentExpiredEvents : [];

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
						Events can be featured for {FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
					</p>
				</CardContent>
			</Card>
		);
	}

	// If all featured events have no timestamps
	if (eventStatuses.every(status => !status.endTime)) {
		return (
			<Card className="mb-8 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-orange-600" />
						Feature Periods Not Configured
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-lg font-semibold text-orange-700 dark:text-orange-300 mb-2">
						{featuredEvents.length} event{featuredEvents.length > 1 ? 's' : ''} featured, but timestamps missing
					</div>
					<p className="text-sm text-muted-foreground">
						Add a "Featured At" column to your spreadsheet with timestamps to see countdown timers
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
									<EventCountdownCard key={status.event.id} eventStatus={status} />
								))}
							</div>
						</div>
					)}

					{/* Expired Events */}
					{recentExpiredEvents.length > 0 && (
						<div>
							<div className="flex items-center justify-between mb-3">
								<h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
									⏰ Recently Ended ({recentExpiredEvents.length})
								</h5>
								<button
									onClick={() => setShowExpired(!showExpired)}
									className="text-xs text-muted-foreground hover:text-foreground transition-colors"
								>
									{showExpired ? "Hide" : "Show"}
								</button>
							</div>
							{showExpired && (
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{expiredEventsToShow.map((status) => (
										<EventCountdownCard key={status.event.id} eventStatus={status} />
									))}
								</div>
							)}
						</div>
					)}

					{/* Summary Info */}
					<div className="text-xs text-muted-foreground pt-3 border-t space-y-1">
						<div className="flex items-center justify-between">
							<span>
								⏱️ Feature duration: {FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours • 🔄 Updates every minute
							</span>
							{activeEvents.length > 0 && (
								<span className="text-green-600 dark:text-green-400 font-medium">
									{activeEvents.length} live
								</span>
							)}
						</div>
						{recentExpiredEvents.length > 0 && (
							<div className="text-gray-500">
								🧹 Expired events auto-hide after 48 hours to keep this list clean
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
} 