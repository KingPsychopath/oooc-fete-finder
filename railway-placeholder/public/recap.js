(() => {
	const root = document.documentElement;
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

	root.classList.add("has-js");

	const revealTargets = [
		...document.querySelectorAll(
			".story, .stat-card, .feature-story, .signal-board > div, .nearby, .taste, .top-events, .mobile-note, .cta",
		),
	];

	if (!reduceMotion.matches && "IntersectionObserver" in window) {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.dataset.visible = "true";
					observer.unobserve(entry.target);
				}
			},
			{ rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
		);

		for (const target of revealTargets) {
			target.dataset.reveal = "true";
			observer.observe(target);
		}

		setTimeout(() => {
			for (const target of revealTargets) {
				target.dataset.visible = "true";
				observer.unobserve(target);
			}
		}, 900);
	}
})();
