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
import { Lightbulb } from "lucide-react";

type ThemeToggleProps = {
	className?: string;
};

export const ThemeToggle = ({ className }: ThemeToggleProps) => {
	const { theme, toggleTheme, currentThemeIcon, nextThemeLabel, mounted } =
		useThemeToggle();
	const isLightTheme = mounted && theme === "light";

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
						<span className="inline-flex h-full w-full items-center justify-center text-base leading-none select-none">
							{isLightTheme ?
								<Lightbulb className="h-[1.05rem] w-[1.05rem]" />
							:	currentThemeIcon}
						</span>
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
