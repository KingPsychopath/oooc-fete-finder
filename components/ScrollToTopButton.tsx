"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// Configurable appearance threshold (percentage of page scrolled)
const SCROLL_APPEARANCE_THRESHOLD = 20; // Show button after scrolling 1/3 of the page

type ScrollToTopButtonProps = {
	className?: string;
};

export const ScrollToTopButton = ({ className = "" }: ScrollToTopButtonProps) => {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const toggleVisibility = () => {
			// Show button when user has scrolled down at least the configured threshold
			const scrolled = document.documentElement.scrollTop;
			const maxHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
			const scrollPercentage = (scrolled / maxHeight) * 100;
			
			if (scrollPercentage > SCROLL_APPEARANCE_THRESHOLD) {
				setIsVisible(true);
			} else {
				setIsVisible(false);
			}
		};

		window.addEventListener("scroll", toggleVisibility);

		return () => window.removeEventListener("scroll", toggleVisibility);
	}, []);

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
				${isVisible 
					? 'opacity-100 translate-y-0 pointer-events-auto' 
					: 'opacity-0 translate-y-4 pointer-events-none'
				}
				${className}
			`}
			style={{
				transitionTimingFunction: isVisible 
					? 'cubic-bezier(0.16, 1, 0.3, 1)' // Smooth ease-out for entry
					: 'cubic-bezier(0.7, 0, 0.84, 0)' // Smooth ease-in for exit
			}}
			size="icon"
			variant="outline"
			aria-label="Scroll to top"
		>
			<ChevronUp className="h-4 w-4" />
		</Button>
	);
}; 