"use client";

interface UserProfileStorageKeyInput {
	userId?: string | null;
	isAuthenticated: boolean;
	anonymousKey: string;
}

export const getUserProfileStorageKey = ({
	userId,
	isAuthenticated,
	anonymousKey,
}: UserProfileStorageKeyInput): string => {
	const normalizedUserId = userId?.trim();
	if (isAuthenticated && normalizedUserId) return `user:${normalizedUserId}`;
	return anonymousKey;
};
