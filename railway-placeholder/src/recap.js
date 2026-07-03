import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "./styles.css";

(() => {
	const root = document.documentElement;
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
	const soundtrack = document.querySelector("[data-soundtrack]");
	const soundToggle = document.querySelector("[data-sound-toggle]");
	const tasteSection = document.querySelector(".taste");

	root.classList.add("has-js");

	gsap.registerPlugin(ScrollTrigger);

	if (!reduceMotion.matches) {
		const lenis = new Lenis({
			duration: 1.05,
			easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
			anchors: true,
			smoothWheel: true,
			wheelMultiplier: 0.92,
		});

		lenis.on("scroll", ScrollTrigger.update);
		gsap.ticker.add((time) => {
			lenis.raf(time * 1000);
		});
		gsap.ticker.lagSmoothing(0);
		root.classList.add("has-smooth-scroll");
	}

	const revealTargets = [
		...document.querySelectorAll(
			".story, .hero-stat, .stat-card, .day-chart, .feature-story, .signal-item, .nearby, .nearby-ledger span, .taste, .genre-list div, .top-events, .top-events li, .mobile-note, .cta, .cta-ticket",
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

	if (!reduceMotion.matches) {
		for (const target of revealTargets) {
			target.dataset.reveal = "true";
		}

		gsap.set(".marker", { "--marker-scale": 0 });
		gsap
			.timeline({ defaults: { ease: "power3.out" } })
			.from(".quiet-brand", { y: 18, autoAlpha: 0, duration: 0.65 })
			.from(
				"#page-title span",
				{ yPercent: 18, autoAlpha: 0, duration: 0.9, stagger: 0.1 },
				"-=0.35",
			)
			.from(".opening", { y: 18, autoAlpha: 0, duration: 0.72 }, "-=0.42")
			.to(".marker", { "--marker-scale": 1, duration: 0.8 }, "-=0.2")
			.from(".tiny-note", { y: 14, autoAlpha: 0, duration: 0.65 }, "-=0.42")
			.from(".scroll-cue", { y: -8, autoAlpha: 0, duration: 0.6 }, "-=0.22");

		gsap.to(".hero", {
			"--hero-scale": 1.04,
			ease: "none",
			scrollTrigger: {
				trigger: ".hero",
				start: "top top",
				end: "bottom top",
				scrub: true,
			},
		});

		for (const target of revealTargets) {
			ScrollTrigger.create({
				trigger: target,
				start: "top 82%",
				once: true,
				onEnter: () => {
					target.dataset.visible = "true";
					for (const counter of target.querySelectorAll("[data-count]")) {
						animateCount(counter);
					}
					if (target.matches("[data-count]")) {
						animateCount(target);
					}
				},
			});
		}

		setTimeout(() => {
			for (const target of revealTargets) {
				if (target.dataset.visible === "true") continue;
				target.dataset.visible = "true";
				for (const counter of target.querySelectorAll("[data-count]")) {
					animateCount(counter);
				}
				if (target.matches("[data-count]")) {
					animateCount(target);
				}
			}
		}, 1600);

		gsap.from(".ticker-track", {
			xPercent: -4,
			ease: "none",
			scrollTrigger: {
				trigger: ".ticker",
				start: "top bottom",
				end: "bottom top",
				scrub: 0.8,
			},
		});

		gsap.from(".stats-showcase > *", {
			y: 42,
			rotate: (index) => [-1.2, 0.8, -0.55, 1][index] || 0,
			autoAlpha: 0,
			duration: 1.05,
			immediateRender: false,
			stagger: 0.08,
			ease: "power3.out",
			scrollTrigger: {
				trigger: ".stats-showcase",
				start: "top 78%",
				once: true,
			},
		});

		gsap.from(".weekend-wave .wave-line", {
			strokeDashoffset: 1,
			duration: 1.45,
			ease: "power3.inOut",
			scrollTrigger: {
				trigger: ".rhythm",
				start: "top 66%",
				once: true,
			},
		});

		gsap.from(".signal-item svg", {
			y: 12,
			rotate: -4,
			autoAlpha: 0,
			duration: 0.7,
			immediateRender: false,
			stagger: 0.06,
			ease: "power3.out",
			scrollTrigger: {
				trigger: ".signal-board",
				start: "top 76%",
				once: true,
			},
		});

		gsap.from(".cta-ticket", {
			y: 28,
			rotate: -14,
			autoAlpha: 0,
			duration: 0.9,
			immediateRender: false,
			ease: "elastic.out(1, 0.72)",
			scrollTrigger: {
				trigger: ".cta",
				start: "top 72%",
				once: true,
			},
		});
	} else {
		for (const target of countTargets) {
			animateCount(target);
		}
	}

	if (soundtrack && soundToggle && tasteSection) {
		const maxVolume = 0.72;
		let soundEnabled = false;
		let targetVolume = 0;
		let currentVolume = 0;
		let fadeFrame = 0;

		soundtrack.volume = 0;

		const setSoundState = (state) => {
			soundToggle.dataset.soundState = state;
			soundToggle.textContent = state === "on" ? "Playing" : "Listen";
		};

		const fade = () => {
			currentVolume += (targetVolume - currentVolume) * 0.075;
			if (Math.abs(targetVolume - currentVolume) < 0.004) {
				currentVolume = targetVolume;
			}
			soundtrack.volume = Math.max(0, Math.min(maxVolume, currentVolume));

			if (currentVolume !== targetVolume) {
				fadeFrame = requestAnimationFrame(fade);
			} else {
				fadeFrame = 0;
			}
		};

		const setTargetVolume = (volume) => {
			targetVolume = soundEnabled
				? Math.max(0, Math.min(maxVolume, volume))
				: 0;
			if (!fadeFrame) {
				fadeFrame = requestAnimationFrame(fade);
			}
		};

		const startSound = async () => {
			try {
				await soundtrack.play();
				soundEnabled = true;
				setSoundState("on");
				setTargetVolume(
					tasteSection.dataset.soundActive === "true" ? maxVolume : 0,
				);
			} catch {
				soundEnabled = false;
				setSoundState("off");
			}
		};

		soundToggle.addEventListener("click", () => {
			if (soundEnabled) {
				soundEnabled = false;
				setSoundState("off");
				setTargetVolume(0);
				return;
			}

			startSound();
		});

		if ("IntersectionObserver" in window) {
			const soundObserver = new IntersectionObserver(
				(entries) => {
					const entry = entries[0];
					const active = entry.isIntersecting && entry.intersectionRatio > 0.28;
					tasteSection.dataset.soundActive = active ? "true" : "false";
					setTargetVolume(active ? maxVolume : 0);
				},
				{ threshold: [0, 0.15, 0.28, 0.45, 0.7] },
			);

			soundObserver.observe(tasteSection);
		}
	}
})();
