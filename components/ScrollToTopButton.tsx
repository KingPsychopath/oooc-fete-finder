"use client";

import { Button } from "@/components/ui/button";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

// Configurable appearance threshold (percentage of page scrolled)
const SCROLL_APPEARANCE_THRESHOLD = 2; // Show button shortly after the user starts scrolling

type ScrollToTopButtonProps = {
	className?: string;
};

export const ScrollToTopButton = ({
	className = "",
}: ScrollToTopButtonProps) => {
	const { isVisible } = useScrollVisibility({
		threshold: SCROLL_APPEARANCE_THRESHOLD,
		mode: "show-after",
		initiallyVisible: false,
	});

	const scrollToTop = () => {
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		});
	};

	return (
		<Button
			onClick={scrollToTop}
			className={cn(
				"fixed bottom-4 right-[7.5rem] lg:right-4 z-[80] size-10 rounded-full border border-border/80 bg-background/52 text-foreground/85 shadow-lg backdrop-blur-sm hover:bg-accent transition-all duration-500 ease-out",
				isVisible
					? "opacity-100 translate-y-0 pointer-events-auto"
					: "opacity-0 translate-y-4 pointer-events-none",
				className,
			)}
			style={{
				transitionTimingFunction: isVisible
					? "cubic-bezier(0.16, 1, 0.3, 1)" // Smooth ease-out for entry
					: "cubic-bezier(0.7, 0, 0.84, 0)", // Smooth ease-in for exit
			}}
			size="icon"
			variant="outline"
			aria-label="Scroll to top"
		>
			<ChevronUp className="h-4 w-4" />
		</Button>
	);
};
