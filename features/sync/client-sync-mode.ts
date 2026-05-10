"use client";

export type ClientAuthMode = "signed-out" | "live" | "offline-grace";
export type ClientSyncMode = "live-sync" | "local-only" | "offline-grace";
export type PendingSyncStatus = "idle" | "offline" | "retrying";

interface ClientSyncModeInput {
	isAuthenticated: boolean;
	authMode: ClientAuthMode;
	isOnline: boolean;
}

export function getClientSyncMode({
	authMode,
	isAuthenticated,
	isOnline,
}: ClientSyncModeInput): ClientSyncMode {
	if (isAuthenticated && authMode === "live" && isOnline) return "live-sync";
	if (isAuthenticated && authMode === "offline-grace") return "offline-grace";
	return "local-only";
}

export const canSyncAccountData = (syncMode: ClientSyncMode): boolean =>
	syncMode === "live-sync";

export const getPendingSyncStatus = (
	pendingCount: number,
	isOnline: boolean,
): PendingSyncStatus => {
	if (pendingCount <= 0) return "idle";
	return isOnline ? "retrying" : "offline";
};
