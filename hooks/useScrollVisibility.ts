"use client";

import { useEffect, useState } from "react";

type UseScrollVisibilityOptions = {
	threshold: number; // Percentage of page scrolled (0-100)
	mode?: "show-after" | "hide-after"; // Show after threshold or hide after threshold
	initiallyVisible?: boolean;
};

type UseScrollVisibilityReturn = {
	isVisible: boolean;
	scrollPercentage: number;
};

/**
 * Custom hook for scroll-based visibility detection with performance optimizations.
 *
 * @example
 * // Scroll-to-top button
 * const { isVisible } = useScrollVisibility({
 *   threshold: 20,
 *   mode: "show-after",
 *   initiallyVisible: false,
 * });
 *
 * // Vignette ads
 * const { isVisible } = useScrollVisibility({
 *   threshold: 20,
 *   mode: "hide-after",
 *   initiallyVisible: true,
 * });
 *
 * @param options - Configuration options
 * @param options.threshold - Percentage of page scrolled (0-100)
 * @param options.mode - "show-after" (default) shows element after threshold, "hide-after" hides element after threshold
 * @param options.initiallyVisible - Initial visibility state
 * @returns Object containing isVisible boolean and current scrollPercentage
 */
export function useScrollVisibility({
	threshold,
	mode = "show-after",
	initiallyVisible = false,
}: UseScrollVisibilityOptions): UseScrollVisibilityReturn {
	const [isVisible, setIsVisible] = useState(initiallyVisible);
	const [scrollPercentage, setScrollPercentage] = useState(0);

	useEffect(() => {
		const handleScroll = () => {
			// Calculate scroll percentage
			const scrolled = document.documentElement.scrollTop;
			const maxHeight =
				document.documentElement.scrollHeight -
				document.documentElement.clientHeight;

			// Avoid division by zero for short pages
			let currentScrollPercentage = 0;
			if (maxHeight > 0) {
				currentScrollPercentage = (scrolled / maxHeight) * 100;
			}

			setScrollPercentage(currentScrollPercentage);

			// Determine visibility based on mode
			if (mode === "show-after") {
				// Show element after scrolling past threshold (e.g., scroll-to-top button)
				setIsVisible(currentScrollPercentage > threshold);
			} else {
				// Hide element after scrolling past threshold (e.g., vignette ad)
				setIsVisible(currentScrollPercentage <= threshold);
			}
		};

		// Initial check
		handleScroll();

		// Add scroll listener with throttling for performance
		let ticking = false;
		const throttledScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					handleScroll();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", throttledScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", throttledScroll);
		};
	}, [threshold, mode]);

	return { isVisible, scrollPercentage };
}
