"use client";

import { Button } from "@/components/ui/button";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { cn } from "@/lib/utils";
import { ChevronUp } from "lucide-react";

// Configurable appearance threshold (percentage of page scrolled)
const SCROLL_APPEARANCE_THRESHOLD = 10; // Show button after scrolling 10% of the page

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
					"ooo-scroll-crescent fixed bottom-[5.25rem] right-4 sm:bottom-4 sm:right-5 z-[60] size-[3.2rem] p-0 transition-all duration-500",
					isVisible
						? "translate-y-0 opacity-100 pointer-events-auto"
						: "translate-y-4 opacity-0 pointer-events-none",
				className,
			)}
			style={{
				transitionTimingFunction: isVisible
					? "cubic-bezier(0.16, 1, 0.3, 1)" // Smooth ease-out for entry
					: "cubic-bezier(0.7, 0, 0.84, 0)", // Smooth ease-in for exit
			}}
			size="icon"
			variant="ghost"
			aria-label="Scroll to top"
		>
			<ChevronUp className="relative z-[2] h-4 w-4 -translate-x-[0.16rem]" />
		</Button>
	);
};
