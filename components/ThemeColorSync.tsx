"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const LIGHT_THEME_COLOR = "#f6f3ee";
const DARK_THEME_COLOR = "#1f1915";

/**
 * Syncs meta theme-color and background-color with the active theme for PWA chrome and status bar.
 * Renders nothing; must be used inside ThemeProvider.
 */
export function ThemeColorSync() {
	const { resolvedTheme } = useTheme();

	useEffect(() => {
		if (typeof document === "undefined") return;
		const isDark = resolvedTheme === "dark";
		const color = isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
		const themeMeta = document.querySelector('meta[name="theme-color"]');
		const bgMeta = document.querySelector('meta[name="background-color"]');
		if (themeMeta) themeMeta.setAttribute("content", color);
		if (bgMeta) bgMeta.setAttribute("content", color);
	}, [resolvedTheme]);

	return null;
}
