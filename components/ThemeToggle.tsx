"use client";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useThemeToggle } from "@/hooks/useThemeToggle";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
	className?: string;
};

export const ThemeToggle = ({ className }: ThemeToggleProps) => {
	const { toggleTheme, currentThemeIcon, nextThemeLabel, mounted } =
		useThemeToggle();

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						onClick={toggleTheme}
						className={cn("h-9 w-9", className)}
						disabled={!mounted}
					>
						<span className="text-base">{currentThemeIcon}</span>
						<span className="sr-only">Toggle theme</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>
						{mounted ? `Switch to ${nextThemeLabel} mode` : "Loading theme..."}
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

// have to update
