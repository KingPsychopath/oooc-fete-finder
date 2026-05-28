import { getEventLocationDisplay } from "@/features/events/types";
import { describe, expect, it } from "vitest";

describe("getEventLocationDisplay", () => {
	it("uses concise public copy for unlisted multi-site events", () => {
		const display = getEventLocationDisplay({
			arrondissement: "multiple-locations",
			location: "Multiple locations",
		});

		expect(display.state).toBe("multiple-unlisted");
		expect(display.areaShortLabel).toBe("Multi-site");
		expect(display.areaLongLabel).toBe("Multiple Locations");
		expect(display.sectionLabel).toBe("Multiple locations");
		expect(display.modalLabel).toBe("Exact venue list not provided");
	});

	it("keeps listed multi-site venues distinct from the section label", () => {
		const display = getEventLocationDisplay({
			arrondissement: "multiple-locations",
			location: "Multiple locations",
			locations: ["Venue A", "Venue B"],
		});

		expect(display.state).toBe("multiple-listed");
		expect(display.areaShortLabel).toBe("Multi-site");
		expect(display.sectionLabel).toBe("Location");
		expect(display.cardLabel).toBe("2 locations");
	});

	it("treats structured location entries as canonical multi-site data", () => {
		const display = getEventLocationDisplay({
			arrondissement: "multiple-locations",
			location: "Multiple locations",
			locationEntries: [
				{
					name: "Venue A",
					arrondissement: 10,
					address: "10 Rue Example",
					postalCode: "75010",
					city: "Paris",
				},
				{
					name: "Venue B",
					arrondissement: 11,
					address: "11 Rue Example",
					postalCode: "75011",
					city: "Paris",
				},
			],
		});

		expect(display.state).toBe("multiple-listed");
		expect(display.cardLabel).toBe("2 locations");
		expect(display.listedLocations).toEqual(["Venue A", "Venue B"]);
		expect(display.listedLocationEntries[0]).toMatchObject({
			name: "Venue A",
			address: "10 Rue Example",
			postalCode: "75010",
		});
	});
});
