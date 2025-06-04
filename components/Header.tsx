"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Moon, Sun, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import Image from "next/image";
import Countdown from "@/components/Countdown";

const Header: React.FC = () => {
	const [currentTime, setCurrentTime] = useState(new Date());
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);

		return () => clearInterval(timer);
	}, []);

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

	const toggleTheme = () => {
		setTheme(theme === "dark" ? "light" : "dark");
	};

	if (!mounted) {
		return (
			<header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						{/* Left - Event Branding */}
						<div className="flex items-center space-x-3 flex-1">
							<Music className="h-8 w-8 text-primary" />
							<div>
								<h1 className="text-2xl font-bold">Fête de la Musique</h1>
								<p className="text-sm text-muted-foreground">
									Paris 2025 • OOOC
								</p>
							</div>
						</div>

						{/* Center - OOOC Logo */}
						<div className="flex justify-center flex-1">
							<Image
								src="/OOOCLogoDark.svg"
								alt="OOOC - Event Organizer"
								width={120}
								height={120}
								className="h-24 w-24 sm:h-32 sm:w-32 dark:invert"
							/>
						</div>

						{/* Right - Spacer for balance */}
						<div className="flex-1"></div>
					</div>
					<Countdown />
				</div>
			</header>
		);
	}

	return (
		<header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
			<div className="container mx-auto px-4 py-4">
				<div className="flex items-center justify-between">
					{/* Left - Event Branding */}
					<div className="flex items-center space-x-3 flex-1">
						<Music className="h-8 w-8 text-primary" />
						<div>
							<h1 className="text-2xl font-bold">Fête de la Musique</h1>
							<p className="text-sm text-muted-foreground">Paris 2025 • OOOC</p>
						</div>
					</div>

					{/* Center - OOOC Logo */}
					<div className="flex justify-center flex-1">
						<Image
							src="/OOOCLogoDark.svg"
							alt="OOOC - Event Organizer"
							width={120}
							height={120}
							className="h-24 w-24 sm:h-32 sm:w-32 transition-transform hover:scale-105 dark:invert"
						/>
					</div>

					{/* Right - Controls */}
					<div className="flex items-center justify-end space-x-4 flex-1">
						{/* Clock */}
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

						{/* Theme toggle */}
						<Button
							variant="outline"
							size="icon"
							onClick={toggleTheme}
							className="h-9 w-9"
						>
							{theme === "dark" ? (
								<Sun className="h-4 w-4" />
							) : (
								<Moon className="h-4 w-4" />
							)}
							<span className="sr-only">Toggle theme</span>
						</Button>
					</div>
				</div>

				<Countdown />
			</div>
		</header>
	);
};

export default Header;
