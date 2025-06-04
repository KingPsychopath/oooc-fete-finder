import { useEffect, useRef } from "react";

/**
 * Custom hook to handle clicks outside of a referenced element
 * @param handler - Function to call when clicking outside the element
 * @returns ref - Ref to attach to the element you want to detect outside clicks for
 */
export const useOutsideClick = <T extends HTMLElement = HTMLElement>(
	handler: () => void,
) => {
	const ref = useRef<T>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				handler();
			}
		};

		// Add event listener on mount
		document.addEventListener("mousedown", handleClickOutside);

		// Cleanup event listener on unmount
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [handler]);

	return ref;
};
