"use client";

import { useEffect } from "react";

/**
 * Client component that handles body className reset during hydration
 * to prevent extension-added classes from causing hydration errors.
 * This component renders nothing but runs the effect on the client.
 */
export function BodyClassHandler() {
	useEffect(() => {
		// Remove any extension-added classes during hydration
		document.body.className = "antialiased";
	}, []);

	// This component renders nothing - it only handles the side effect
	return null;
} 