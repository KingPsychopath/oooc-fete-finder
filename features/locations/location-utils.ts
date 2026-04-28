import type { Coordinates, ParisArrondissement } from "@/features/events/types";
import { PARIS_ARRONDISSEMENTS } from "@/features/events/types";

const PARIS_CENTER: Coordinates = { lat: 48.8566, lng: 2.3522 };

export function generateLocationStorageKey(
	locationName: string,
	arrondissement: ParisArrondissement,
): string {
	const cleanName =
		locationName
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.trim()
			.replace(/&/g, " and ")
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "") || "unknown_location";
	return `${cleanName}_${arrondissement}`;
}

export function isCoordinateResolvableInput(
	locationName: string,
	arrondissement: ParisArrondissement,
): boolean {
	const normalizedLocation = locationName.trim().toLowerCase();
	const hasValidLocation =
		normalizedLocation.length > 0 &&
		normalizedLocation !== "tba" &&
		normalizedLocation !== "tbc" &&
		normalizedLocation !== "location tbc" &&
		normalizedLocation !== "location tba";

	const hasValidArrondissement =
		arrondissement !== "unknown" &&
		typeof arrondissement === "number" &&
		arrondissement >= 1 &&
		arrondissement <= 20;

	return hasValidLocation && hasValidArrondissement;
}

export function getArrondissementCenter(
	arrondissement: ParisArrondissement,
): Coordinates | null {
	const arr = PARIS_ARRONDISSEMENTS.find((item) => item.id === arrondissement);
	if (!arr) return PARIS_CENTER;
	return {
		lat: arr.coordinates.lat,
		lng: arr.coordinates.lng,
	};
}
