"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function prefersReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function findHashTarget(hash: string) {
	const id = decodeURIComponent(hash.slice(1));
	if (!id) return null;
	return (
		document.getElementById(id) ??
		document.querySelector(`[name="${CSS.escape(id)}"]`)
	);
}

function scrollToHash(hash: string, behavior: ScrollBehavior = "smooth") {
	const target = findHashTarget(hash);
	if (!target) return false;

	target.scrollIntoView({
		block: "start",
		behavior: prefersReducedMotion() ? "auto" : behavior,
	});

	return true;
}

function scrollToHashWhenReady(
	hash: string,
	behavior: ScrollBehavior = "smooth",
	attempt = 0,
) {
	if (scrollToHash(hash, behavior)) return;
	if (attempt >= 24) return;

	window.setTimeout(() => {
		scrollToHashWhenReady(hash, behavior, attempt + 1);
	}, 50);
}

export function SmoothAnchorScroll() {
	const pathname = usePathname();
	const previousPathnameRef = useRef(pathname);

	useEffect(() => {
		const handleClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
				return;

			const anchor = (event.target as Element | null)?.closest("a[href]");
			if (!anchor) return;

			const rawHref = anchor.getAttribute("href");
			if (!rawHref?.includes("#") || rawHref === "#main-content") return;
			if (anchor.getAttribute("target")) return;

			const url = new URL(rawHref, window.location.href);
			const isSamePage =
				url.origin === window.location.origin &&
				url.pathname === window.location.pathname &&
				url.search === window.location.search;
			if (!isSamePage || !url.hash) return;

			event.preventDefault();
			window.history.pushState(
				null,
				"",
				`${url.pathname}${url.search}${url.hash}`,
			);
			scrollToHashWhenReady(url.hash);
		};

		document.addEventListener("click", handleClick);
		return () => {
			document.removeEventListener("click", handleClick);
		};
	}, []);

	useEffect(() => {
		const previousPathname = previousPathnameRef.current;
		previousPathnameRef.current = pathname;

		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				if (window.location.hash && window.location.hash !== "#main-content") {
					scrollToHashWhenReady(window.location.hash);
					return;
				}

				if (previousPathname !== pathname) {
					window.scrollTo({ top: 0, behavior: "auto" });
				}
			});
		});
	}, [pathname]);

	return null;
}
