import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGenerateMetadata = async () => {
	vi.resetModules();

	vi.doMock("@/lib/config/env", () => ({
		env: {
			NEXT_PUBLIC_SITE_URL: "https://fete.outofofficecollective.co.uk",
		},
	}));

	vi.doMock("@/features/partners/partner-stats", () => ({
		getPartnerStatsSnapshot: vi.fn(),
	}));

	const module = await import("@/app/partner-stats/[activationId]/page");
	return module.generateMetadata;
};

describe("/partner-stats/[activationId] metadata", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_SITE_URL = "https://fete.outofofficecollective.co.uk";
		process.env.NEXT_PUBLIC_BASE_PATH = "";
	});

	it("keeps partner stats metadata generic, noindex, and token-free", async () => {
		const generateMetadata = await loadGenerateMetadata();
		const metadata = await generateMetadata({
			params: Promise.resolve({
				activationId: "act_123",
			}),
		});

		expect(metadata.robots).toMatchObject({
			index: false,
			follow: false,
		});
		expect(metadata.description).toBe(
			"Private partner performance metrics for OOOC campaign placements.",
		);
		expect(metadata.openGraph?.url).toBe(
			"https://fete.outofofficecollective.co.uk/partner-stats/act_123",
		);

		const openGraphImages = metadata.openGraph?.images;
		const imageRef = Array.isArray(openGraphImages)
			? openGraphImages[0]
			: openGraphImages;

		if (!imageRef || typeof imageRef === "string" || !("url" in imageRef)) {
			throw new Error("Expected object-form Open Graph image metadata");
		}

		const imageUrl = new URL(
			imageRef.url,
			"https://fete.outofofficecollective.co.uk",
		);
		expect(imageUrl.searchParams.get("preset")).toBe(
			"partner-performance-report",
		);
		expect(imageUrl.toString()).not.toContain("token");
		expect(imageUrl.toString()).not.toContain("click");
		expect(imageUrl.toString()).not.toContain("impression");
	});
});
