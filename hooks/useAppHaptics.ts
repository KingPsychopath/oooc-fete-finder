"use client";

import { useLocalAppSettings } from "@/hooks/useLocalAppSettings";
import { useCallback, useMemo } from "react";
import { useWebHaptics } from "web-haptics/react";

type AppHapticPattern =
	| "selection"
	| "light"
	| "medium"
	| "success"
	| "warning"
	| "error"
	| "nudge";

function hasCoarsePointer() {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(pointer: coarse)").matches;
}

export function useAppHaptics() {
	const { trigger, isSupported } = useWebHaptics();
	const { settings } = useLocalAppSettings();

	const triggerHaptic = useCallback(
		(pattern: AppHapticPattern) => {
			if (!settings.enableHaptics || !isSupported || !hasCoarsePointer()) {
				return;
			}
			void trigger(pattern);
		},
		[isSupported, settings.enableHaptics, trigger],
	);

	return useMemo(
		() => ({
			isEnabled: settings.enableHaptics && isSupported,
			selection: () => triggerHaptic("selection"),
			light: () => triggerHaptic("light"),
			medium: () => triggerHaptic("medium"),
			success: () => triggerHaptic("success"),
			warning: () => triggerHaptic("warning"),
			error: () => triggerHaptic("error"),
			nudge: () => triggerHaptic("nudge"),
		}),
		[isSupported, settings.enableHaptics, triggerHaptic],
	);
}
