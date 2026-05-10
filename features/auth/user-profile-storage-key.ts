"use client";

interface UserProfileStorageKeyInput {
	email: string | null;
	isAuthenticated: boolean;
	anonymousKey: string;
}

export const getUserProfileStorageKey = ({
	email,
	isAuthenticated,
	anonymousKey,
}: UserProfileStorageKeyInput): string => {
	const normalizedEmail = email?.trim().toLowerCase();
	return isAuthenticated && normalizedEmail
		? `user:${normalizedEmail}`
		: anonymousKey;
};
