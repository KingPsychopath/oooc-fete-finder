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
		expect(display.sectionLabel).toBe("Location");
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
});
