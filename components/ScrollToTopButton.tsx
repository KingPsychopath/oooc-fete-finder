"use client";

import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";

// Configurable appearance threshold (percentage of page scrolled)
const SCROLL_APPEARANCE_THRESHOLD = 20; // Show button after scrolling 20% of the page

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
			className={`
				fixed bottom-4 right-30 lg:right-4 z-40 shadow-lg
				transition-all duration-500 ease-out
				${
					isVisible
						? "opacity-100 translate-y-0 pointer-events-auto"
						: "opacity-0 translate-y-4 pointer-events-none"
				}
				${className}
			`}
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
