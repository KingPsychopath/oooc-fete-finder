"use client";

import { useEffect, useState } from "react";

const formatTime = (date: Date) => {
	return date.toLocaleTimeString("fr-FR", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		timeZone: "Europe/Paris",
	});
};

const formatDate = (date: Date) => {
	return date.toLocaleDateString("fr-FR", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "Europe/Paris",
	});
};

export const Clock = () => {
	const [currentTime, setCurrentTime] = useState(new Date());
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);

		return () => clearInterval(timer);
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
