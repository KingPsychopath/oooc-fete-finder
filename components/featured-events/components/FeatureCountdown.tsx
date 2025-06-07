"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useFeatureTimeRemaining } from "../hooks/use-feature-time-remaining";
import { FEATURED_EVENTS_CONFIG } from "../constants";

type FeatureCountdownProps = {
	endDate: Date;
};

export function FeatureCountdown({ endDate }: FeatureCountdownProps) {
	// Always call hooks first (rules of hooks)
	const { timeRemaining, isExpired } = useFeatureTimeRemaining(endDate);

	// Validate endDate after hooks
	if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
		return (
			<Card className="mb-8 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
				<CardContent className="p-4">
					<div className="text-sm text-red-600 dark:text-red-400">
						Invalid feature period date
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Clock className="h-5 w-5 text-blue-600" />
					Current Feature Period
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className={`text-lg font-semibold ${
					isExpired 
						? "text-red-700 dark:text-red-300" 
						: "text-blue-700 dark:text-blue-300"
				}`}>
					{timeRemaining}
				</div>
				<p className="text-sm text-muted-foreground mt-1">
					Featured events are rotated every {FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
				</p>
			</CardContent>
		</Card>
	);
} 