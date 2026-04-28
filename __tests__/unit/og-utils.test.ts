import { beforeEach, describe, expect, it, vi } from "vitest";

const loadOgUtils = async () => {
	vi.resetModules();
	vi.doMock("@/lib/config/env", () => ({
		env: {
			NEXT_PUBLIC_SITE_URL: "https://fete-finder.ooo",
		},
	}));
	return import("@/lib/social/og-utils");
};

describe("og-utils", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("builds branded main OG route URL with bounded preset params", async () => {
		const { generateMainOGImage } = await loadOgUtils();
		const url = generateMainOGImage(81);

		expect(url).toBe("/api/og?preset=home");
	});

	it("builds event OG route URL with only the event key", async () => {
		const { generateEventOGImage } = await loadOgUtils();
		const url = generateEventOGImage({
			eventKey: "evt_77b18c8e22eadd87",
		});

		expect(url).toBe("/api/og?preset=event&eventKey=evt_77b18c8e22eadd87");
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
});
