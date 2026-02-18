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

	it("builds branded main OG route URL with default theme params", async () => {
		const { generateMainOGImage } = await loadOgUtils();
		const url = generateMainOGImage(81);

		expect(url).toContain("/api/og?");
		expect(url).toContain("theme=default");
		expect(url).toContain("eventCount=81");
		expect(url).toContain("title=F%C3%AAte+Finder");
	});

	it("builds complete Open Graph/Twitter metadata payload", async () => {
		const { generateOGMetadata } = await loadOgUtils();
		const metadata = generateOGMetadata({
			title: "Fete Finder",
			description: "Curated Paris music events",
			ogImageUrl: "/api/og?theme=default",
		});

		expect(metadata.openGraph.url).toBe("https://fete-finder.ooo");
		expect(metadata.openGraph.images[0]).toMatchObject({
			url: "/api/og?theme=default",
			width: 1200,
			height: 630,
			type: "image/png",
		});
		expect(metadata.twitter.card).toBe("summary_large_image");
		expect(metadata.twitter.images[0]).toMatchObject({
			url: "/api/og?theme=default",
		});
	});
});
