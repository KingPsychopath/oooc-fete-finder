import "server-only";

const warnIfServiceAccountKeyMalformed = (): void => {
	const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
	if (!rawKey) {
		return;
	}

	try {
		const parsed = JSON.parse(rawKey) as {
			client_email?: unknown;
			private_key?: unknown;
		};
		if (
			typeof parsed.client_email !== "string" ||
			typeof parsed.private_key !== "string" ||
			parsed.client_email.trim() === "" ||
			parsed.private_key.trim() === ""
		) {
			console.warn(
				"[fete-finder] Warning | GOOGLE_SERVICE_ACCOUNT_KEY is set but missing client_email/private_key fields.",
			);
		}
	} catch {
		console.warn(
			"[fete-finder] Warning | GOOGLE_SERVICE_ACCOUNT_KEY is set but is not valid JSON.",
		);
	}
};

export async function runNodeInstrumentation(): Promise<void> {
	const dataMode = process.env.DATA_MODE ?? "remote";
	const hasDb = Boolean(process.env.DATABASE_URL);
	const hasGeocoding = Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());

	const parts = [
		"[fete-finder] Ready",
		`data=${dataMode}`,
		`db=${hasDb ? "yes" : "no"}`,
		`geocoding=${hasGeocoding ? "api" : "arrondissement-fallback"}`,
	];
	console.log(parts.join(" | "));
	warnIfServiceAccountKeyMalformed();
}
