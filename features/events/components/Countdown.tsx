"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";

type CountdownTime = {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
};

const getFeteDateForYear = (year: number): Date =>
	new Date(`${year}-06-21T00:00:00+02:00`);

const getNextFeteDate = (referenceDate: Date): Date => {
	const candidate = getFeteDateForYear(referenceDate.getFullYear());
	return referenceDate.getTime() <= candidate.getTime() ?
			candidate
		:	getFeteDateForYear(referenceDate.getFullYear() + 1);
};

const eventDate = getNextFeteDate(new Date());
const eventDateLabel = new Intl.DateTimeFormat("en-GB", {
	weekday: "long",
	month: "long",
	day: "numeric",
	year: "numeric",
	timeZone: "Europe/Paris",
}).format(eventDate);

const Countdown: React.FC = () => {
	const [mounted, setMounted] = useState(false);

	const calculateCountdown = useCallback((now: Date): CountdownTime => {
		const difference = eventDate.getTime() - now.getTime();

		if (difference <= 0) {
			return { days: 0, hours: 0, minutes: 0, seconds: 0 };
		}

		const days = Math.floor(difference / (1000 * 60 * 60 * 24));
		const hours = Math.floor(
			(difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
		);
		const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((difference % (1000 * 60)) / 1000);

		return { days, hours, minutes, seconds };
	}, []);

	const [countdown, setCountdown] = useState<CountdownTime>(() =>
		calculateCountdown(new Date()),
	);

	const formatCountdown = (countdown: CountdownTime): string => {
		if (
			countdown.days === 0 &&
			countdown.hours === 0 &&
			countdown.minutes === 0 &&
			countdown.seconds === 0
		) {
			return "🎉 C'est aujourd'hui ! Fête de la Musique is happening now! 🎊";
		}

		const parts = [];
		if (countdown.days > 0) parts.push(`${countdown.days}d`);
		if (countdown.hours > 0) parts.push(`${countdown.hours}h`);
		if (countdown.minutes > 0) parts.push(`${countdown.minutes}m`);
		if (countdown.seconds > 0) parts.push(`${countdown.seconds}s`);

		return `⏰ ${parts.join(" ")} until ${eventDateLabel}`;
	};

	useEffect(() => {
		setMounted(true);

		const timer = setInterval(() => {
			const now = new Date();
			setCountdown(calculateCountdown(now));
		}, 1000);

		return () => clearInterval(timer);
	}, [calculateCountdown]);

	// Show static placeholder during SSR and initial hydration to prevent mismatches
	if (!mounted) {
		return (
			<div className="text-center">
				<div className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium font-mono min-w-[200px] justify-center">
					⏰ Loading countdown...
				</div>
			</div>
		);
	}

	return (
		<div className="text-center">
			<div className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium font-mono min-w-[200px] justify-center">
				{formatCountdown(countdown)}
			</div>
		</div>
	);
};

export default Countdown;
