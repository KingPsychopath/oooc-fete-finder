"use client";

import { Clock } from "@/components/Clock";
import Countdown from "@/components/Countdown";
import SlidingBanner from "@/components/SlidingBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
// Note: Using process.env directly to avoid server-side env variable access on client
import { LogOut, MapPin, Music, User, Utensils } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Get base path from environment variable directly
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

const Header = () => {
	const { isAuthenticated, userEmail, logout } = useAuth();

	return (
		<>
			<header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
				<div className="container mx-auto px-4 py-3 sm:py-4 md:py-4">
					<div className="relative flex items-center min-h-[60px] sm:min-h-[80px] md:min-h-[96px]">
						{/* Left Section - Mobile: OOOC Logo Left, Desktop: Event Branding Left */}
						<div className="flex items-center space-x-2 sm:space-x-3 flex-1">
							{/* OOOC Logo - Left on mobile, hidden on desktop */}
							<Link
								href="https://outofofficecollective.co.uk"
								target="_blank"
								rel="noopener noreferrer"
								className="relative h-10 w-10 sm:h-12 sm:w-12 sm:hidden flex-shrink-0"
							>
								<Image
									src={`${basePath}/OOOCLogoDark.svg`}
									alt="OOOC - Event Organizer"
									fill
									priority
									sizes="(max-width: 640px) 40px, 48px"
									className="object-contain transition-transform hover:scale-105 dark:invert"
								/>
							</Link>

							{/* Music icon and text - Hidden on mobile, shown on desktop */}
							<div className="hidden sm:flex items-center space-x-2 md:space-x-3">
								<Music className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-primary flex-shrink-0" />
								<div className="min-w-0">
									<h1 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight">
										Fête Finder
									</h1>
									<p className="text-xs sm:text-sm text-muted-foreground leading-tight">
										Paris 2025 • OOOC
									</p>
								</div>
							</div>
						</div>

						{/* Center Section - Absolutely centered regardless of left/right content */}
						<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
							{/* Fête Finder title - Centered on mobile, hidden on desktop */}
							<div className="text-center sm:hidden px-2">
								<h1 className="text-lg sm:text-xl font-bold leading-tight">
									Fête Finder
								</h1>
								<p className="text-xs text-muted-foreground leading-tight">
									Paris 2025 • OOOC
								</p>
							</div>

							{/* OOOC Logo - Centered on desktop, hidden on mobile */}
							<Link
								href="https://outofofficecollective.co.uk"
								target="_blank"
								rel="noopener noreferrer"
								className="relative h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 hidden sm:block flex-shrink-0"
							>
								<Image
									src={`${basePath}/OOOCLogoDark.svg`}
									alt="OOOC - Event Organizer"
									fill
									priority
									sizes="(max-width: 640px) 80px, (max-width: 768px) 96px, (max-width: 1024px) 112px, 128px"
									className="object-contain transition-transform hover:scale-105 dark:invert"
								/>
							</Link>
						</div>

						{/* Right Section - Controls */}
						<div className="flex flex-col items-end space-y-2 flex-1">
							{/* Top Row - Main Controls */}
							<div className="flex items-center justify-end space-x-2 sm:space-x-3 w-full">
								{/* Paris Food List Link */}
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Link
												href="https://maps.app.goo.gl/YZdYYpsh2ViR2tQi8?g_st=i"
												target="_blank"
												rel="noopener noreferrer"
												className="group flex-shrink-0"
												aria-label="View Paris Food Guide by Mel on Google Maps"
											>
												<Button
													variant="outline"
													size="sm"
													className="gap-1 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground transition-colors p-1.5 sm:p-2 h-8 sm:h-9"
												>
													<div className="flex items-center gap-1">
														<Utensils className="h-3 w-3 sm:h-4 sm:w-4" />
														<MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
													</div>
												</Button>
											</Link>
										</TooltipTrigger>
										<TooltipContent>
											<p>View Paris Food Guide by Mel on Google Maps</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>

								<div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
									<Clock />
									<ThemeToggle />
								</div>
							</div>

							{/* Bottom Row - Authentication Status */}
							{isAuthenticated && userEmail && (
								<div className="hidden sm:flex items-center justify-end space-x-2 flex-shrink-0">
									<Badge variant="secondary" className="gap-1 text-xs">
										<User className="h-3 w-3" />
										<span className="max-w-[80px] truncate">
											{userEmail.split("@")[0]}
										</span>
									</Badge>
									<Button
										variant="ghost"
										size="sm"
										onClick={logout}
										className="h-7 w-7 p-0 flex-shrink-0"
										title="Logout"
									>
										<LogOut className="h-3.5 w-3.5" />
									</Button>
								</div>
							)}
						</div>
					</div>

					{/* Countdown Section with optimized spacing */}

					<Countdown />
				</div>
			</header>
			<SlidingBanner
				messages={[
					"When I push it in",
					"When I push it in",
					"She say ooouuuuuuuu",
					"Start relaxing your hair!",
				]}
				speed={15}
			/>
		</>
	);
};

export default Header;
