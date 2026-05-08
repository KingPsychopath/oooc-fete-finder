export const CARD_SOCIAL_PROOF_MIN_SAVES = 3;
export const CARD_SOCIAL_PROOF_MAX_VISIBLE = 9;
export const CARD_SOCIAL_PROOF_MAX_NUMERIC = 3;
export const CARD_SOCIAL_PROOF_HISTORICAL_MIN_SAVES = 10;
export const CARD_SOCIAL_PROOF_HISTORICAL_WINDOW_DAYS = 30;
export const SOCIAL_PROOF_FINAL_WINDOW_DAYS = 7;
export const SOCIAL_PROOF_MIDDLE_WINDOW_DAYS = 14;
export const SOCIAL_PROOF_EARLY_WINDOW_DAYS = 21;

export type SocialProofDisplayMode = "numeric" | "generic";

type SocialProofEvent = {
	eventKey: string;
	name: string;
	socialProofSaveCount?: number;
	socialProofHistoricalSaveCount?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getSocialProofSaveWindowDays = (
	now: Date = new Date(),
): number => {
	const feteDate = new Date(Date.UTC(now.getUTCFullYear(), 5, 21));
	const daysUntilFete = Math.ceil(
		(feteDate.getTime() - now.getTime()) / MS_PER_DAY,
	);

	if (daysUntilFete <= SOCIAL_PROOF_FINAL_WINDOW_DAYS) {
		return SOCIAL_PROOF_FINAL_WINDOW_DAYS;
	}

	if (daysUntilFete <= SOCIAL_PROOF_EARLY_WINDOW_DAYS) {
		return SOCIAL_PROOF_MIDDLE_WINDOW_DAYS;
	}

	return SOCIAL_PROOF_EARLY_WINDOW_DAYS;
};

export const getSocialProofDisplayModes = (
	events: SocialProofEvent[],
): Map<string, SocialProofDisplayMode> => {
	const eligibleEvents = events
		.filter(
			(event) =>
				(event.socialProofSaveCount ?? 0) >= CARD_SOCIAL_PROOF_MIN_SAVES ||
				(event.socialProofHistoricalSaveCount ?? 0) >=
					CARD_SOCIAL_PROOF_HISTORICAL_MIN_SAVES,
		)
		.sort((left, right) => {
			const syncDelta =
				(right.socialProofSaveCount ?? 0) - (left.socialProofSaveCount ?? 0);
			if (syncDelta !== 0) return syncDelta;
			const historicalSyncDelta =
				(right.socialProofHistoricalSaveCount ?? 0) -
				(left.socialProofHistoricalSaveCount ?? 0);
			if (historicalSyncDelta !== 0) return historicalSyncDelta;
			const nameOrder = left.name.localeCompare(right.name);
			if (nameOrder !== 0) return nameOrder;
			return left.eventKey.localeCompare(right.eventKey);
		})
		.slice(0, CARD_SOCIAL_PROOF_MAX_VISIBLE);

	const numericEventKeys = new Set(
		events
			.filter(
				(event) =>
					(event.socialProofSaveCount ?? 0) >= CARD_SOCIAL_PROOF_MIN_SAVES,
			)
			.sort((left, right) => {
				const syncDelta =
					(right.socialProofSaveCount ?? 0) -
					(left.socialProofSaveCount ?? 0);
				if (syncDelta !== 0) return syncDelta;
				const nameOrder = left.name.localeCompare(right.name);
				if (nameOrder !== 0) return nameOrder;
				return left.eventKey.localeCompare(right.eventKey);
			})
			.slice(0, CARD_SOCIAL_PROOF_MAX_NUMERIC)
			.map((event) => event.eventKey),
	);

	return new Map(
		eligibleEvents.map((event) => [
			event.eventKey,
			numericEventKeys.has(event.eventKey) ? "numeric" : "generic",
		]),
	);
};

export const shouldShowSocialProofBadge = (
	mode: SocialProofDisplayMode | undefined,
	socialProofSaveCount: number,
	socialProofHistoricalSaveCount = 0,
): boolean => {
	if (!mode) return false;
	if (socialProofSaveCount >= CARD_SOCIAL_PROOF_MIN_SAVES) return true;
	return (
		mode === "generic" &&
		socialProofHistoricalSaveCount >= CARD_SOCIAL_PROOF_HISTORICAL_MIN_SAVES
	);
};
