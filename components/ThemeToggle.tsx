"use client";

import { Button } from "@/components/ui/button";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const ThemeToggle = () => {
	const { toggleTheme, currentThemeIcon, nextThemeLabel } = useThemeToggle();

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						onClick={toggleTheme}
						className="h-9 w-9"
					>
						<span className="text-base">{currentThemeIcon}</span>
						<span className="sr-only">Toggle theme</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Switch to {nextThemeLabel} mode</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

// have to update
