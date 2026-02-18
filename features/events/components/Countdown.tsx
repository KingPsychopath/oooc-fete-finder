"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
	isActive?: boolean;
}

interface CountdownState {
	days: number;
	hours: number;
	minutes: number;
	targetLabel: string;
	isLiveToday: boolean;
}

const getFeteDateForYear = (year: number): Date =>
	new Date(`${year}-06-21T00:00:00+02:00`);

const PARIS_YEAR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	timeZone: "Europe/Paris",
});
const PARIS_MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	month: "2-digit",
	day: "2-digit",
	timeZone: "Europe/Paris",
});
const EVENT_DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
	weekday: "long",
	month: "long",
	day: "numeric",
	year: "numeric",
	timeZone: "Europe/Paris",
});

const getParisYear = (referenceDate: Date): number =>
	Number(PARIS_YEAR_FORMATTER.format(referenceDate));

const isFeteDayInParis = (referenceDate: Date): boolean =>
	PARIS_MONTH_DAY_FORMATTER.format(referenceDate) === "21/06";

const getNextFeteDate = (referenceDate: Date): Date => {
	const candidate = getFeteDateForYear(referenceDate.getFullYear());
	return referenceDate.getTime() <= candidate.getTime()
		? candidate
		: getFeteDateForYear(referenceDate.getFullYear() + 1);
};

const calculateCountdown = (referenceDate: Date): CountdownState => {
	if (isFeteDayInParis(referenceDate)) {
		const currentYearEventDate = getFeteDateForYear(
			getParisYear(referenceDate),
		);
		return {
			days: 0,
			hours: 0,
			minutes: 0,
			targetLabel: EVENT_DATE_LABEL_FORMATTER.format(currentYearEventDate),
			isLiveToday: true,
		};
	}

	const eventDate = getNextFeteDate(referenceDate);
	const difference = eventDate.getTime() - referenceDate.getTime();
	const days = Math.floor(difference / (1000 * 60 * 60 * 24));
	const hours = Math.floor(
		(difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
	);
	const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

	return {
		days,
		hours,
		minutes,
		targetLabel: EVENT_DATE_LABEL_FORMATTER.format(eventDate),
		isLiveToday: false,
	};
};

const formatCountdown = (countdown: CountdownState): string => {
	if (countdown.isLiveToday) {
		return "Live today in Paris";
	}

	const parts: string[] = [];
	if (countdown.days > 0) parts.push(`${countdown.days}d`);
	if (countdown.hours > 0 || countdown.days > 0)
		parts.push(`${countdown.hours}h`);
	parts.push(`${countdown.minutes}m`);

	return `${parts.join(" ")} until ${countdown.targetLabel}`;
};

const Countdown = ({ isActive = true }: CountdownProps) => {
	const [mounted, setMounted] = useState(false);
	const [countdown, setCountdown] = useState<CountdownState>(() =>
		calculateCountdown(new Date()),
	);

	useEffect(() => {
		setMounted(true);
		setCountdown(calculateCountdown(new Date()));
		if (!isActive) return;

		const updateCountdown = () => {
			setCountdown(calculateCountdown(new Date()));
		};
		const timer = setInterval(() => {
			updateCountdown();
		}, 60000);

		return () => clearInterval(timer);
	}, [isActive]);

	if (!mounted) {
		return (
			<div className="text-center">
				<div className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-border/75 bg-card/78 px-3 py-1 text-[11px] tracking-[0.08em] text-foreground/70 sm:min-w-[280px] sm:text-xs">
					Fete de la Musique
				</div>
			</div>
		);
	}

	return (
		<div className="text-center">
			<div
				className="inline-flex min-w-[220px] items-center justify-center rounded-full border border-border/75 bg-card/78 px-3 py-1 text-[11px] tracking-[0.08em] text-foreground/80 sm:min-w-[280px] sm:text-xs"
				aria-live="polite"
			>
				<span className="text-foreground/62">Fete de la Musique</span>
				<span className="mx-2 text-foreground/45">•</span>
				<span className="font-medium text-foreground">
					{formatCountdown(countdown)}
				</span>
			</div>
		</div>
	);
};

export default Countdown;
