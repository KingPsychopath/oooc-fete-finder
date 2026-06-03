import { beforeEach, describe, expect, it, vi } from "vitest";

const loadOgUtils = async () => {
	vi.resetModules();
	process.env.NEXT_PUBLIC_SITE_URL = "https://fete-finder.ooo";
	process.env.NEXT_PUBLIC_BASE_PATH = "";
	delete process.env.NEXT_PUBLIC_OG_IMAGE_VERSION;
	return import("@/lib/social/og-utils");
};

describe("og-utils", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses a static PNG for the main preset OG image", async () => {
		const { generateMainOGImage } = await loadOgUtils();
		const url = generateMainOGImage(81);

		expect(url).toBe("/og/home.png");
	});

	it("versions static preset OG images when an OG image version is configured", async () => {
		vi.resetModules();
		process.env.NEXT_PUBLIC_SITE_URL = "https://fete-finder.ooo";
		process.env.NEXT_PUBLIC_BASE_PATH = "";
		process.env.NEXT_PUBLIC_OG_IMAGE_VERSION = "og-20260603";

		const { generatePresetOGImage } = await import("@/lib/social/og-utils");

		expect(generatePresetOGImage("home")).toBe(
			"/og/home.png?v=og-20260603",
		);
	});

	it("builds event OG route URL with only the event key", async () => {
		const { generateEventOGImage } = await loadOgUtils();
		const url = generateEventOGImage({
			eventKey: "evt_77b18c8e22eadd87",
		});

		expect(url).toBe("/api/og?preset=event&eventKey=evt_77b18c8e22eadd87");
	});

	it("builds a bounded shared plan OG route URL", async () => {
		const { generateSharedPlanOGImage } = await loadOgUtils();
		const url = generateSharedPlanOGImage({
			stopCount: 123,
			planDateLabel: "Sunday 21st",
		});

		expect(url).toBe(
			"/api/og?preset=shared-plan&stopCount=99&planDate=Sunday+21st",
		);
	});

	it("builds complete Open Graph/Twitter metadata payload", async () => {
		const { generateOGMetadata } = await loadOgUtils();
		const metadata = generateOGMetadata({
			title: "Fete Finder",
			description: "Curated Paris music events",
			ogImageUrl: "/api/og?variant=default",
		});

		expect(metadata.openGraph.url).toBe("https://fete-finder.ooo");
		expect(metadata.openGraph.images[0]).toMatchObject({
			url: "/api/og?variant=default",
			width: 1200,
			height: 630,
			type: "image/png",
		});
		expect(metadata.twitter.card).toBe("summary_large_image");
		expect(metadata.twitter.images[0]).toMatchObject({
			url: "/api/og?variant=default",
		});
	});

	it("normalizes trailing site URL slashes in canonical metadata", async () => {
		vi.resetModules();
		process.env.NEXT_PUBLIC_SITE_URL = "https://fete-finder.ooo/";
		process.env.NEXT_PUBLIC_BASE_PATH = "";

		const [{ generateOGMetadata }, { buildSiteUrl }] = await Promise.all([
			import("@/lib/social/og-utils"),
			import("@/lib/site-url"),
		]);
		const metadata = generateOGMetadata({
			title: "Privacy Policy",
			description: "Data handling",
			ogImageUrl: "/og/privacy.png",
			url: buildSiteUrl("/privacy"),
		});

		expect(metadata.alternates.canonical).toBe(
			"https://fete-finder.ooo/privacy",
		);
	});
});
