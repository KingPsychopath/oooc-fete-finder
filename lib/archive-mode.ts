const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", ""]);

export const parseBooleanFlag = (value?: string | null): boolean => {
	const normalized = (value ?? "").trim().toLowerCase();
	if (TRUE_VALUES.has(normalized)) return true;
	if (FALSE_VALUES.has(normalized)) return false;
	return false;
};

export const isArchiveModeEnabled = (): boolean =>
	parseBooleanFlag(process.env.ARCHIVE_MODE) ||
	parseBooleanFlag(process.env.NEXT_PUBLIC_ARCHIVE_MODE);

export const isFirstPartyAnalyticsEnabled = (): boolean =>
	!isArchiveModeEnabled() &&
	!["0", "false", "no", "off"].includes(
		(process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? "true").trim().toLowerCase(),
	);

export const getRuntimeDataMode = (
	configuredMode: "remote" | "local" | "test",
): "remote" | "local" | "test" => {
	if (configuredMode === "test") return configuredMode;
	return isArchiveModeEnabled() ? "local" : configuredMode;
};
