import type { ParisArrondissement } from "@/features/events/types";
import { generateLocationStorageKey } from "./location-utils";
import type { StoredLocationResolution } from "./types";

export type SheetLocationTrustState =
	| "manual"
	| "geocoded"
	| "approximate"
	| "unresolved";

export type SheetLocationResolution = Pick<
	StoredLocationResolution,
	| "id"
	| "name"
	| "arrondissement"
	| "address"
	| "postalCode"
	| "city"
	| "countryCode"
	| "coordinates"
	| "source"
	| "precision"
	| "confidence"
	| "formattedAddress"
	| "provider"
	| "lastUpdated"
	| "lastResolvedAt"
>;

export type SheetLocationResolutionIndex = Record<
	string,
	SheetLocationResolution
>;

export type LocationAliasCandidate = {
	key: string;
	name: string;
	arrondissement: ParisArrondissement;
	address?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
};

export type LocationAliasMatch = LocationAliasCandidate & {
	reason: "same-normalized-name" | "similar-name";
};

export const toSheetLocationResolutionIndex = (
	resolutions: Iterable<StoredLocationResolution>,
): SheetLocationResolutionIndex => {
	const index: SheetLocationResolutionIndex = {};
	for (const resolution of resolutions) {
		index[resolution.id] = {
			id: resolution.id,
			name: resolution.name,
			arrondissement: resolution.arrondissement,
			address: resolution.address,
			postalCode: resolution.postalCode,
			city: resolution.city,
			countryCode: resolution.countryCode,
			coordinates: resolution.coordinates,
			source: resolution.source,
			precision: resolution.precision,
			confidence: resolution.confidence,
			formattedAddress: resolution.formattedAddress,
			provider: resolution.provider,
			lastUpdated: resolution.lastUpdated,
			lastResolvedAt: resolution.lastResolvedAt,
		};
	}
	return index;
};

export const getSheetLocationResolutionKey = (
	locationName: string,
	arrondissement: ParisArrondissement,
	place: Pick<
		StoredLocationResolution,
		"address" | "postalCode" | "city" | "countryCode"
	> = {},
): string => generateLocationStorageKey(locationName, arrondissement, place);

export const getSheetLocationTrustState = (
	resolution: SheetLocationResolution | null | undefined,
): SheetLocationTrustState => {
	if (!resolution?.coordinates) return "unresolved";
	if (resolution.source === "manual") return "manual";
	if (resolution.source === "geocoded") return "geocoded";
	return "approximate";
};

export const normalizeLocationAliasText = (value: string): string =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/\bl['’]/g, " ")
		.replace(/['’]/g, "")
		.replace(/\b(the|le|la|les|l|de|du|des|club|paris)\b/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");

const levenshteinDistance = (left: string, right: string): number => {
	if (left === right) return 0;
	if (!left) return right.length;
	if (!right) return left.length;

	const previous = Array.from(
		{ length: right.length + 1 },
		(_, index) => index,
	);
	const current = Array.from({ length: right.length + 1 }, () => 0);

	for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
		current[0] = leftIndex;
		for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
			const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
			current[rightIndex] = Math.min(
				current[rightIndex - 1] + 1,
				previous[rightIndex] + 1,
				previous[rightIndex - 1] + cost,
			);
		}
		previous.splice(0, previous.length, ...current);
	}

	return previous[right.length] ?? 0;
};

const isSimilarLocationName = (left: string, right: string): boolean => {
	if (left.length < 5 || right.length < 5) return false;
	const distance = levenshteinDistance(left, right);
	const maxLength = Math.max(left.length, right.length);
	return distance <= 2 || distance / maxLength <= 0.18;
};

export const findLikelyLocationAliases = (
	target: LocationAliasCandidate,
	candidates: LocationAliasCandidate[],
): LocationAliasMatch[] => {
	const targetText = normalizeLocationAliasText(target.name);
	if (!targetText) return [];

	const seen = new Set<string>();
	const matches: LocationAliasMatch[] = [];

	for (const candidate of candidates) {
		if (
			candidate.key === target.key ||
			candidate.arrondissement !== target.arrondissement ||
			seen.has(candidate.key)
		) {
			continue;
		}

		const candidateText = normalizeLocationAliasText(candidate.name);
		if (!candidateText) continue;

		if (candidateText === targetText) {
			seen.add(candidate.key);
			continue;
		}

		if (isSimilarLocationName(targetText, candidateText)) {
			seen.add(candidate.key);
			matches.push({ ...candidate, reason: "similar-name" });
		}
	}

	return matches.slice(0, 3);
};
