const FALLBACK_DEPLOYMENT_ID = "local-development";

export const getCurrentDeploymentId = (): string => {
	const candidates = [
		process.env.NEXT_PUBLIC_DEPLOYMENT_ID,
		process.env.VERCEL_DEPLOYMENT_ID,
		process.env.VERCEL_URL,
		process.env.VERCEL_GIT_COMMIT_SHA,
		process.env.BUILD_ID,
	];

	for (const candidate of candidates) {
		const value = candidate?.trim();
		if (value) return value;
	}

	return FALLBACK_DEPLOYMENT_ID;
};
