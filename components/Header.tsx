import { Music } from "lucide-react";
import Image from "next/image";
import Countdown from "@/components/Countdown";
import { Clock } from "@/components/Clock";
import { ThemeToggle } from "@/components/ThemeToggle";
import SlidingBanner from "@/components/SlidingBanner";

// Get base path from environment variable
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const Header = () => {
	return (
		<>
			<header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						{/* Mobile: OOOC Logo Left, Desktop: Event Branding Left */}
						<div className="flex items-center space-x-3 flex-1">
							{/* OOOC Logo - Left on mobile, hidden on desktop */}
							<div className="relative h-12 w-12 sm:hidden">
								<Image
									src={`${basePath}/OOOCLogoDark.svg`}
									alt="OOOC - Event Organizer"
									fill
									priority
									sizes="48px"
									className="object-contain transition-transform hover:scale-105 dark:invert"
								/>
							</div>

							{/* Music icon and text - Hidden on mobile, shown on desktop */}
							<div className="hidden sm:flex items-center space-x-3">
								<Music className="h-8 w-8 text-primary" />
								<div>
									<h1 className="text-2xl font-bold">Fête Finder</h1>
									<p className="text-sm text-muted-foreground">
										Paris 2025 • OOOC
									</p>
								</div>
							</div>
						</div>

						{/* Mobile: Fête Finder Center, Desktop: OOOC Logo Center */}
						<div className="flex justify-center flex-1">
							{/* Fête Finder title - Centered on mobile, hidden on desktop */}
							<div className="text-center sm:hidden">
								<h1 className="text-xl font-bold">Fête Finder</h1>
								<p className="text-xs text-muted-foreground">Paris 2025 • OOOC</p>
							</div>

							{/* OOOC Logo - Centered on desktop, hidden on mobile */}
							<div className="relative h-24 w-24 sm:h-32 sm:w-32 hidden sm:block">
								<Image
									src={`${basePath}/OOOCLogoDark.svg`}
									alt="OOOC - Event Organizer"
									fill
									priority
									sizes="(max-width: 640px) 96px, 128px"
									className="object-contain transition-transform hover:scale-105 dark:invert"
								/>
							</div>
						</div>

						{/* Right - Controls */}
						<div className="flex items-center justify-end space-x-4 flex-1">
							<Clock />
							<ThemeToggle />
						</div>
					</div>
					<div className="mt-4 sm:mt-2">
						<Countdown />
					</div>
				</div>
			</header>
			<SlidingBanner 
				messages={["When I push it in", "When I push it in", "She say ooouuuuuuuu"]}
				speed={15}
			/>
		</>
	);
};

export default Header;
