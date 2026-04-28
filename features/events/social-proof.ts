export const CARD_SOCIAL_PROOF_MIN_SAVES = 3;
export const CARD_SOCIAL_PROOF_MAX_VISIBLE = 9;
export const CARD_SOCIAL_PROOF_MAX_NUMERIC = 3;
export const SOCIAL_PROOF_SAVE_WINDOW_DAYS = 7;

export type SocialProofDisplayMode = "numeric" | "generic";

type SocialProofEvent = {
	eventKey: string;
	name: string;
	socialProofSaveCount?: number;
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
