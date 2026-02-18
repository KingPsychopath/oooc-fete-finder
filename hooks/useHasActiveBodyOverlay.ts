"use client";

import {
	OVERLAY_BODY_ATTRIBUTE,
	hasActiveBodyOverlay,
} from "@/lib/ui/overlay-state";
import { useEffect, useState } from "react";

export function useHasActiveBodyOverlay(): boolean {
	const [hasOverlay, setHasOverlay] = useState(false);

	useEffect(() => {
		setHasOverlay(hasActiveBodyOverlay());

		const observer = new MutationObserver(() => {
			setHasOverlay(hasActiveBodyOverlay());
		});

		observer.observe(document.body, {
			attributes: true,
			attributeFilter: Object.values(OVERLAY_BODY_ATTRIBUTE),
		});

		return () => observer.disconnect();
	}, []);

	return hasOverlay;
}
