"use client";

import { useState, useEffect } from "react";
import type { FeatureTimeRemaining } from "../types";

/**
 * Custom hook to calculate time remaining for a feature period
 * Updates every minute to show live countdown
 */
export function useFeatureTimeRemaining(
	endDate: Date | null,
): FeatureTimeRemaining {
	const [timeRemaining, setTimeRemaining] = useState<FeatureTimeRemaining>(() =>
		calculateTimeRemaining(endDate),
	);

	useEffect(() => {
		const interval = setInterval(() => {
			setTimeRemaining(calculateTimeRemaining(endDate));
		}, 60000); // Update every minute

		return () => clearInterval(interval);
	}, [endDate]);

	return timeRemaining;
}

function calculateTimeRemaining(endDate: Date | null): FeatureTimeRemaining {
	if (!endDate) {
		return {
			timeRemaining: "No active feature period",
			isExpired: true,
		};
	}

	const now = new Date();
	const timeDiff = endDate.getTime() - now.getTime();

	if (timeDiff <= 0) {
		return {
			timeRemaining: "Featured period has ended",
			isExpired: true,
		};
	}

	const hours = Math.floor(timeDiff / (1000 * 60 * 60));
	const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

	let formattedTime: string;

	if (hours > 24) {
		const days = Math.floor(hours / 24);
		const remainingHours = hours % 24;
		formattedTime = `${days} day${days > 1 ? "s" : ""} ${remainingHours} hour${remainingHours !== 1 ? "s" : ""} remaining`;
	} else if (hours > 0) {
		formattedTime = `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""} remaining`;
	} else {
		formattedTime = `${minutes} minute${minutes !== 1 ? "s" : ""} remaining`;
	}

	return {
		timeRemaining: formattedTime,
		isExpired: false,
	};
}
