"use client";

import { useEffect } from "react";

export function SubmitEventScrollReset() {
	useEffect(() => {
		window.requestAnimationFrame(() => {
			window.scrollTo({ top: 0, behavior: "auto" });
		});
	}, []);

	return null;
}
