export const CARD_SOCIAL_PROOF_MIN_SAVES = 3;
export const CARD_SOCIAL_PROOF_MAX_VISIBLE = 9;
export const CARD_SOCIAL_PROOF_MAX_NUMERIC = 3;
export const SOCIAL_PROOF_FINAL_WINDOW_DAYS = 7;
export const SOCIAL_PROOF_MIDDLE_WINDOW_DAYS = 14;
export const SOCIAL_PROOF_EARLY_WINDOW_DAYS = 21;

export type SocialProofDisplayMode = "numeric" | "generic";

type SocialProofEvent = {
	eventKey: string;
	name: string;
	socialProofSaveCount?: number;
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
				(event.socialProofSaveCount ?? 0) >= CARD_SOCIAL_PROOF_MIN_SAVES,
		)
		.sort((left, right) => {
			const syncDelta =
				(right.socialProofSaveCount ?? 0) - (left.socialProofSaveCount ?? 0);
			if (syncDelta !== 0) return syncDelta;
			const nameOrder = left.name.localeCompare(right.name);
			if (nameOrder !== 0) return nameOrder;
			return left.eventKey.localeCompare(right.eventKey);
		})
		.slice(0, CARD_SOCIAL_PROOF_MAX_VISIBLE);

	return new Map(
		eligibleEvents.map((event, index) => [
			event.eventKey,
			index < CARD_SOCIAL_PROOF_MAX_NUMERIC ? "numeric" : "generic",
		]),
	);
};
