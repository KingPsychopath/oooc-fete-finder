"use client";

import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebHaptics } from "web-haptics/react";

type AppHapticPattern =
	| "selection"
	| "light"
	| "medium"
	| "success"
	| "warning"
	| "error"
	| "nudge";

export function useAppHaptics() {
	const { trigger, isSupported } = useWebHaptics();
	const { settings } = useLocalAppSettings();
	const [isCoarsePointer, setIsCoarsePointer] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mediaQuery = window.matchMedia("(pointer: coarse)");
		setIsCoarsePointer(mediaQuery.matches);

		const handleChange = (event: MediaQueryListEvent) => {
			setIsCoarsePointer(event.matches);
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	const triggerHaptic = useCallback(
		(pattern: AppHapticPattern) => {
			if (!settings.enableHaptics) {
				return;
			}
			void trigger(pattern);
		},
		[settings.enableHaptics, trigger],
	);

	return useMemo(
		() => ({
			isSupported,
			isCoarsePointer,
			canTrigger: settings.enableHaptics,
			isEnabled: settings.enableHaptics,
			selection: () => triggerHaptic("selection"),
			light: () => triggerHaptic("light"),
			medium: () => triggerHaptic("medium"),
			success: () => triggerHaptic("success"),
			warning: () => triggerHaptic("warning"),
			error: () => triggerHaptic("error"),
			nudge: () => triggerHaptic("nudge"),
		}),
		[isCoarsePointer, isSupported, settings.enableHaptics, triggerHaptic],
	);
}
