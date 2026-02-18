"use client";

import { useEffect, useState } from "react";

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	timeZone: "Europe/Paris",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
	weekday: "long",
	year: "numeric",
	month: "long",
	day: "numeric",
	timeZone: "Europe/Paris",
});

const formatTime = (date: Date) => {
	return TIME_FORMATTER.format(date);
};

const formatDate = (date: Date) => {
	return DATE_FORMATTER.format(date);
};

export const Clock = () => {
	const [currentTime, setCurrentTime] = useState(new Date());
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		let timer: ReturnType<typeof setInterval> | null = null;

		const updateTime = () => {
			setCurrentTime(new Date());
		};

		const startTimer = () => {
			if (timer) return;
			updateTime();
			timer = setInterval(updateTime, 1000);
		};

		const stopTimer = () => {
			if (!timer) return;
			clearInterval(timer);
			timer = null;
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				startTimer();
				return;
			}
			stopTimer();
		};

		startTimer();
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			stopTimer();
		};
	}, []);

	if (!mounted) return null;

	return (
		<>
			<div className="text-center hidden md:block">
				<div className="text-lg font-mono font-bold">
					{formatTime(currentTime)}
				</div>
				<div className="text-xs text-muted-foreground">
					{formatDate(currentTime)}
				</div>
			</div>

			{/* Mobile clock */}
			<div className="text-center md:hidden sm:block hidden">
				<div className="text-sm font-mono font-bold">
					{formatTime(currentTime)}
				</div>
			</div>
		</>
	);
};
