"use client";

interface UserProfileStorageKeyInput {
	userId?: string | null;
	email: string | null;
	isAuthenticated: boolean;
	anonymousKey: string;
}

export const getUserProfileStorageKey = ({
	userId,
	email,
	isAuthenticated,
	anonymousKey,
}: UserProfileStorageKeyInput): string => {
	const normalizedUserId = userId?.trim();
	const normalizedEmail = email?.trim().toLowerCase();
	if (isAuthenticated && normalizedUserId) return `user:${normalizedUserId}`;
	return isAuthenticated && normalizedEmail
		? `user:${normalizedEmail}`
		: anonymousKey;
};
