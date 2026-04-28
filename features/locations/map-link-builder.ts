import type { Coordinates, ParisArrondissement } from "@/features/events/types";
import { isTrustedLocationResolution } from "./types";
import type { LocationResolution } from "./types";

export type MapLinkProvider = "google" | "apple" | "geo";

export interface MapLinkInput {
	locationInput: string;
	arrondissement?: ParisArrondissement;
	resolution?: LocationResolution | null;
	provider: MapLinkProvider;
}

const getOrdinal = (num: number): string => {
	const lastDigit = num % 10;
	const lastTwoDigits = num % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${num}th`;
	if (lastDigit === 1) return `${num}st`;
	if (lastDigit === 2) return `${num}nd`;
	if (lastDigit === 3) return `${num}rd`;
	return `${num}th`;
};

export const buildLocationSearchQuery = (
	locationInput: string,
	arrondissement?: ParisArrondissement,
): string => {
	const value = locationInput.trim();
	if (
		arrondissement &&
		arrondissement !== "unknown" &&
		typeof arrondissement === "number"
	) {
		return `${value} ${getOrdinal(arrondissement)} arrondissement`;
	}
	return value;
};

const formatCoordinates = ({ lat, lng }: Coordinates): string => `${lat},${lng}`;

export const buildMapLink = ({
	locationInput,
	arrondissement,
	resolution,
	provider,
}: MapLinkInput): string => {
	const trustedCoordinates = isTrustedLocationResolution(resolution)
		? resolution?.coordinates
		: null;
	const query = trustedCoordinates
		? formatCoordinates(trustedCoordinates)
		: buildLocationSearchQuery(locationInput, arrondissement);
	const encodedQuery = encodeURIComponent(query);

	if (provider === "apple") {
		return `maps://?q=${encodedQuery}`;
	}
	if (provider === "geo") {
		return `geo:0,0?q=${encodedQuery}`;
	}
	return `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
};
