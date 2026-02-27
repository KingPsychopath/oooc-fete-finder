type SearchQueryCount = {
	query: string;
	count: number;
};

export type ClusteredSearchQuery = {
	query: string;
	count: number;
	variantCount: number;
	variants: Array<{ query: string; count: number }>;
};

export type SearchClusterMode = "conservative" | "aggressive";

type QueryVariant = {
	query: string;
	count: number;
	normalized: string;
	compact: string;
	tokens: string[];
	tokenSet: Set<string>;
};

const QUERY_SYNONYMS = new Map<string, string>([
	["afrohouse", "afro house"],
	["afro-house", "afro house"],
	["rnb", "r&b"],
	["r and b", "r&b"],
	["hiphop", "hip hop"],
	["ukg", "uk garage"],
	["afo house", "afro house"],
]);

const stripDiacritics = (value: string): string =>
	value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const normalizeQuery = (raw: string): string => {
	const base = stripDiacritics(raw.toLowerCase())
		.replace(/[^\p{L}\p{N}&]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (base.length === 0) return "";
	const mapped = QUERY_SYNONYMS.get(base);
	return mapped ?? base;
};

const toVariant = (input: SearchQueryCount): QueryVariant | null => {
	const normalized = normalizeQuery(input.query);
	if (!normalized) return null;
	const compact = normalized.replace(/\s+/g, "");
	const tokens = normalized.split(" ").filter((token) => token.length > 0);
	return {
		query: input.query,
		count: input.count,
		normalized,
		compact,
		tokens,
		tokenSet: new Set(tokens),
	};
};

const levenshteinDistance = (left: string, right: string): number => {
	if (left === right) return 0;
	if (left.length === 0) return right.length;
	if (right.length === 0) return left.length;
	const matrix: number[][] = Array.from({ length: left.length + 1 }, () =>
		Array.from({ length: right.length + 1 }, () => 0),
	);
	for (let index = 0; index <= left.length; index += 1) {
		matrix[index][0] = index;
	}
	for (let index = 0; index <= right.length; index += 1) {
		matrix[0][index] = index;
	}
	for (let i = 1; i <= left.length; i += 1) {
		for (let j = 1; j <= right.length; j += 1) {
			const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + substitutionCost,
			);
		}
	}
	return matrix[left.length][right.length];
};

const jaccardSimilarity = (left: Set<string>, right: Set<string>): number => {
	let intersection = 0;
	for (const token of left) {
		if (right.has(token)) {
			intersection += 1;
		}
	}
	const union = left.size + right.size - intersection;
	if (union === 0) return 0;
	return intersection / union;
};

const areVariantsSimilar = (
	left: QueryVariant,
	right: QueryVariant,
	mode: SearchClusterMode,
): boolean => {
	if (left.normalized === right.normalized) return true;
	if (left.compact === right.compact) return true;

	const minLength = Math.min(left.compact.length, right.compact.length);
	const maxLength = Math.max(left.compact.length, right.compact.length);
	const distance = levenshteinDistance(left.compact, right.compact);
	const distanceRatio = maxLength === 0 ? 0 : distance / maxLength;

	if (minLength <= 6 && distance <= 1) return true;
	if (mode === "conservative") {
		if (minLength > 6 && distance <= 1 && distanceRatio <= 0.14) return true;
	} else if (minLength > 6 && distance <= 2 && distanceRatio <= 0.22) {
		return true;
	}

	const tokenSimilarity = jaccardSimilarity(left.tokenSet, right.tokenSet);
	if (mode === "conservative") {
		if (tokenSimilarity >= 0.9) return true;
	} else if (tokenSimilarity >= 0.8) {
		return true;
	}

	if (mode === "aggressive" && minLength >= 5) {
		if (
			left.compact.includes(right.compact) ||
			right.compact.includes(left.compact)
		) {
			return true;
		}
	}

	if (mode === "conservative" && minLength >= 6 && distance <= 1) {
		return true;
	}

	return false;
};

export const clusterTopSearchQueries = (
	rows: SearchQueryCount[],
	limit: number,
	mode: SearchClusterMode = "conservative",
): ClusteredSearchQuery[] => {
	const safeLimit = Math.max(1, Math.min(limit, 100));
	const variants = rows
		.map(toVariant)
		.filter((value): value is QueryVariant => value != null)
		.sort((left, right) => right.count - left.count);

	const clusters: Array<{
		rep: QueryVariant;
		totalCount: number;
		variants: QueryVariant[];
	}> = [];

	for (const variant of variants) {
		const cluster = clusters.find((candidate) =>
			areVariantsSimilar(variant, candidate.rep, mode),
		);
		if (!cluster) {
			clusters.push({
				rep: variant,
				totalCount: variant.count,
				variants: [variant],
			});
			continue;
		}
		cluster.totalCount += variant.count;
		cluster.variants.push(variant);
		if (variant.count > cluster.rep.count) {
			cluster.rep = variant;
		}
	}

	return clusters
		.sort((left, right) => right.totalCount - left.totalCount)
		.slice(0, safeLimit)
		.map((cluster) => {
			const orderedVariants = cluster.variants.sort((left, right) => {
				if (right.count !== left.count) return right.count - left.count;
				return left.query.localeCompare(right.query);
			});
			return {
				query: cluster.rep.query,
				count: cluster.totalCount,
				variantCount: orderedVariants.length,
				variants: orderedVariants.map((variant) => ({
					query: variant.query,
					count: variant.count,
				})),
			};
		});
};
