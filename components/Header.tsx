import { Music } from "lucide-react";
import Image from "next/image";
import Countdown from "@/components/Countdown";
import { Clock } from "@/components/Clock";
import { ThemeToggle } from "@/components/ThemeToggle";

// Get base path from environment variable
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const Header = () => {
	return (
		<header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
			<div className="container mx-auto px-4 py-4">
				<div className="flex items-center justify-between">
					{/* Left - Event Branding */}
					<div className="flex items-center space-x-3 flex-1">
						<Music className="h-8 w-8 text-primary" />
						<div>
							<h1 className="text-2xl font-bold">Fête Finder</h1>
							<p className="text-sm text-muted-foreground">Paris 2025 • OOOC</p>
						</div>
					</div>

					{/* Center - OOOC Logo */}
					<div className="flex justify-center flex-1">
						<Image
							src={`${basePath}/OOOCLogoDark.svg`}
							alt="OOOC - Event Organizer"
							width={120}
							height={120}
							className="h-24 w-24 sm:h-32 sm:w-32 transition-transform hover:scale-105 dark:invert"
						/>
					</div>

					{/* Right - Controls */}
					<div className="flex items-center justify-end space-x-4 flex-1">
						<Clock />
						<ThemeToggle />
					</div>
				</div>
				<Countdown />
			</div>
		</header>
	);
};

export default Header;
