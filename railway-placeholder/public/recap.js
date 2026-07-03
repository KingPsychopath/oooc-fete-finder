(() => {
	const root = document.documentElement;
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

	root.classList.add("has-js");

	const revealTargets = [
		...document.querySelectorAll(
			".story, .hero-stat, .stat-card, .day-row, .feature-story, .signal-board > div, .nearby, .taste, .top-events, .mobile-note, .cta",
		),
	];
	const countTargets = [...document.querySelectorAll("[data-count]")];

	const formatNumber = (value) => new Intl.NumberFormat("en-GB").format(value);

	const animateCount = (target) => {
		if (target.dataset.counted === "true") return;

		target.dataset.counted = "true";
		const finalValue = Number(target.dataset.count);
		if (!Number.isFinite(finalValue) || reduceMotion.matches) {
			target.textContent = target.dataset.count
				? formatNumber(finalValue)
				: target.textContent;
			return;
		}

		const duration = 850;
		const start = performance.now();

		const frame = (now) => {
			const progress = Math.min((now - start) / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			target.textContent = formatNumber(Math.round(finalValue * eased));

			if (progress < 1) {
				requestAnimationFrame(frame);
			}
		};

		requestAnimationFrame(frame);
	};

	if (!reduceMotion.matches && "IntersectionObserver" in window) {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.dataset.visible = "true";
					for (const counter of entry.target.querySelectorAll("[data-count]")) {
						animateCount(counter);
					}
					if (entry.target.matches("[data-count]")) {
						animateCount(entry.target);
					}
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
				for (const counter of target.querySelectorAll("[data-count]")) {
					animateCount(counter);
				}
				observer.unobserve(target);
			}
		}, 900);
	} else {
		for (const target of countTargets) {
			animateCount(target);
		}
	}
})();
