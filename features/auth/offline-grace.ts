export type OfflineGraceState = {
	email: string;
	expiresAt: number;
};

export const OFFLINE_GRACE_WINDOW_MS = 72 * 60 * 60 * 1000;

export const parseOfflineGraceState = (
	raw: string | null,
): OfflineGraceState | null => {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<OfflineGraceState>;
		if (
			typeof parsed.email !== "string" ||
			typeof parsed.expiresAt !== "number" ||
			!Number.isFinite(parsed.expiresAt) ||
			parsed.email.trim().length === 0
		) {
			return null;
		}
		return {
			email: parsed.email.trim().toLowerCase(),
			expiresAt: parsed.expiresAt,
		};
	} catch {
		return null;
	}
};

export const createOfflineGraceState = (
	email: string,
	nowMs = Date.now(),
): OfflineGraceState => ({
	email: email.trim().toLowerCase(),
	expiresAt: nowMs + OFFLINE_GRACE_WINDOW_MS,
});

export const isOfflineGraceActive = (
	state: OfflineGraceState,
	nowMs = Date.now(),
): boolean => state.expiresAt > nowMs;
