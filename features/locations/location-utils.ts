import type { Coordinates, ParisArrondissement } from "@/features/events/types";
import {
	PARIS_ARRONDISSEMENTS,
	isNumberedArrondissement,
} from "@/features/events/types";
import type { LocationQuery } from "./types";

const PARIS_CENTER: Coordinates = { lat: 48.8566, lng: 2.3522 };
const DEFAULT_COUNTRY_CODE = "FR";
const GREATER_PARIS_DEPARTMENT_CODES = new Set(["92", "93", "94"]);
const PLACEHOLDER_LOCATION_NAMES = new Set([
	"tba",
	"tbc",
	"location tba",
	"location tbc",
	"multiple locations",
	"unknown location",
	"unknown locations",
	"central paris",
	"paris",
]);

const normalizeKeyPart = (value: string): string =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");

export function generateLocationStorageKey(
	locationName: string,
	arrondissement: ParisArrondissement,
	place: Pick<
		LocationQuery,
		"address" | "postalCode" | "city" | "countryCode"
	> = {},
): string {
	const cleanName = normalizeKeyPart(locationName) || "unknown_location";
	const hasStructuredPlace =
		Boolean(place.address?.trim()) ||
		Boolean(place.postalCode?.trim()) ||
		Boolean(place.city?.trim()) ||
		Boolean(place.countryCode?.trim());
	const structuredParts = [
		normalizeKeyPart(place.address ?? ""),
		normalizePostalCode(place.postalCode),
		normalizeKeyPart(place.city ?? ""),
		hasStructuredPlace ? normalizeCountryCode(place.countryCode) : "",
	].filter(Boolean);

	if (structuredParts.length > 0) {
		return [cleanName, ...structuredParts].join("_");
	}

	return `${cleanName}_${arrondissement}`;
}

export function isCoordinateResolvableInput(
	locationName: string,
	arrondissement: ParisArrondissement,
): boolean {
	const normalizedLocation = locationName
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
	const hasValidLocation =
		normalizedLocation.length > 0 &&
		!PLACEHOLDER_LOCATION_NAMES.has(normalizedLocation);

	const hasValidArrondissement =
		arrondissement !== "unknown" && arrondissement !== "multiple-locations";

	return hasValidLocation && hasValidArrondissement;
}

export function hasStructuredLocationContext(
	place: Pick<
		LocationQuery,
		"address" | "postalCode" | "city" | "countryCode"
	> = {},
): boolean {
	return Boolean(
		normalizeCity(place.address) ||
			normalizePostalCode(place.postalCode) ||
			normalizeCity(place.city),
	);
}

export function canUseProviderLookupForLocationQuery(
	query: LocationQuery,
): boolean {
	if (
		query.arrondissement !== "greater-paris" &&
		query.arrondissement !== "outside-paris"
	) {
		return true;
	}

	return hasStructuredLocationContext(query);
}

export function getArrondissementCenter(
	arrondissement: ParisArrondissement,
): Coordinates | null {
	if (!isNumberedArrondissement(arrondissement)) return null;
	const arr = PARIS_ARRONDISSEMENTS.find((item) => item.id === arrondissement);
	if (!arr) return PARIS_CENTER;
	return {
		lat: arr.coordinates.lat,
		lng: arr.coordinates.lng,
	};
}

export function normalizePostalCode(value: string | null | undefined): string {
	return (value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

export function normalizeCity(value: string | null | undefined): string {
	return (value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeCountryCode(value: string | null | undefined): string {
	const normalized = (value ?? "").trim().toUpperCase();
	return /^[A-Z]{2}$/.test(normalized) ? normalized : DEFAULT_COUNTRY_CODE;
}

export function deriveAreaFromPostalCodeCity(
	postalCodeInput: string | null | undefined,
	cityInput: string | null | undefined,
): ParisArrondissement | null {
	const postalCode = normalizePostalCode(postalCodeInput);
	const city = normalizeCity(cityInput).toLowerCase();

	if (/^750(0[1-9]|1[0-9]|20)$/.test(postalCode)) {
		const arrondissement = Number.parseInt(postalCode.slice(3), 10);
		if (arrondissement >= 1 && arrondissement <= 20) {
			return arrondissement as ParisArrondissement;
		}
	}

	if (postalCode === "75116") return 16;

	if (
		postalCode &&
		GREATER_PARIS_DEPARTMENT_CODES.has(postalCode.slice(0, 2))
	) {
		return "greater-paris";
	}

	if (postalCode && /^[0-9]{5}$/.test(postalCode)) {
		return "outside-paris";
	}

	if (city === "paris") return "unknown";

	return null;
}

export function buildStructuredLocationSearchQuery({
	locationName,
	arrondissement,
	address,
	postalCode,
	city,
	countryCode,
}: LocationQuery): string {
	const location = locationName.trim();
	const normalizedAddress = normalizeCity(address);
	const normalizedPostalCode = normalizePostalCode(postalCode);
	const normalizedCity = normalizeCity(city);
	const normalizedCountryCode = normalizeCountryCode(countryCode);
	const countryLabel =
		normalizedCountryCode === "FR" ? "France" : normalizedCountryCode;
	const postalCity = [normalizedPostalCode, normalizedCity]
		.filter(Boolean)
		.join(" ");
	const structuredParts = [
		location,
		normalizedAddress,
		postalCity,
		countryLabel,
	]
		.filter(Boolean)
		.filter((part, index, parts) => parts.indexOf(part) === index);

	if (normalizedAddress || normalizedPostalCode || normalizedCity) {
		return structuredParts.join(", ");
	}

	if (typeof arrondissement === "number") {
		return `${location}, ${arrondissement}e arrondissement, Paris, France`;
	}

	if (
		arrondissement === "greater-paris" ||
		arrondissement === "outside-paris"
	) {
		return `${location}, France`;
	}

	return `${location}, Paris, France`;
}
