import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedGetEventsData = vi.fn();

const loadGenerateMetadata = async () => {
	vi.resetModules();

	vi.doMock("@/lib/config/env", () => ({
		env: {
			NEXT_PUBLIC_SITE_URL: "https://fete.outofofficecollective.co.uk",
		},
	}));

	vi.doMock("@/features/data-management/data-manager", () => ({
		DataManager: {
			getEventsData: mockedGetEventsData,
		},
	}));

	const module = await import("@/app/event/[eventKey]/[[...slug]]/page");
	return module.generateMetadata;
};

describe("/event/[eventKey]/[[...slug]] metadata", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_SITE_URL = "https://fete.outofofficecollective.co.uk";
		process.env.NEXT_PUBLIC_BASE_PATH = "";
	});

	it("builds canonical and OG metadata with key event chips", async () => {
		mockedGetEventsData.mockResolvedValue({
			success: true,
			data: [
				{
					eventKey: "evt_77b18c8e22eadd87",
					slug: "party-by-kklain",
					id: "evt_77b18c8e22eadd87",
					name: "Party by Kklain",
					day: "saturday",
					date: "2026-06-21",
					time: "16:00",
					endTime: "02:00",
					arrondissement: 10,
					location: "18 Av. Richerand",
					link: "https://example.com/event",
					type: "Day Party",
					genre: ["afrobeats", "amapiano", "dancehall", "rap"],
					venueTypes: ["outdoor"],
					indoor: false,
					verified: true,
					price: "Free",
				},
			],
			count: 1,
			source: "store",
			warnings: [],
		});

		const generateMetadata = await loadGenerateMetadata();
		const metadata = await generateMetadata({
			params: Promise.resolve({
				eventKey: "evt_77b18c8e22eadd87",
				slug: ["party-by-kklain"],
			}),
		});

		const canonical = metadata.alternates?.canonical;
		expect(canonical).toBe(
			"https://fete.outofofficecollective.co.uk/event/evt_77b18c8e22eadd87/party-by-kklain",
		);
		expect(metadata.description).toContain("10e arrondissement");
		expect(metadata.description).toContain("Saturday 21st");
		expect(metadata.description).toContain("16:00 - 02:00");
		expect(metadata.description).toContain("18 Av. Richerand");
		expect(metadata.description).toContain("Free");

		const openGraphImages = metadata.openGraph?.images;
		const imageRef = Array.isArray(openGraphImages)
			? openGraphImages[0]
			: openGraphImages;
		expect(imageRef).toBeTruthy();

		if (!imageRef || typeof imageRef === "string" || !("url" in imageRef)) {
			throw new Error("Expected object-form Open Graph image metadata");
		}

		const imageUrl = new URL(
			imageRef.url,
			"https://fete.outofofficecollective.co.uk",
		);

		expect(imageUrl.pathname).toBe("/api/og");
		expect(imageUrl.searchParams.get("arrondissement")).toBe("10e arrondissement");
		expect(imageUrl.searchParams.get("date")).toBe("Saturday 21st");
		expect(imageUrl.searchParams.get("time")).toBe("16:00 - 02:00");
		expect(imageUrl.searchParams.get("venue")).toBe("18 Av. Richerand");
		expect(imageUrl.searchParams.get("price")).toBe("Free");
		expect(imageUrl.searchParams.get("genres")).toBe("afrobeats,amapiano,dancehall");
	});
});
