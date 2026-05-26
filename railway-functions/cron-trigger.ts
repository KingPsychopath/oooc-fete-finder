const targetUrl = process.env.TARGET_URL?.trim();
const cronSecret = process.env.CRON_SECRET?.trim();

if (!targetUrl) {
	throw new Error("TARGET_URL is required");
}

if (!cronSecret) {
	throw new Error("CRON_SECRET is required");
}

const response = await fetch(targetUrl, {
	headers: {
		authorization: `Bearer ${cronSecret}`,
	},
});

const body = await response.text();

if (!response.ok) {
	throw new Error(
		`Cron target failed with HTTP ${response.status}: ${body.slice(0, 500)}`,
	);
}

console.log(`Cron target succeeded: ${response.status} ${targetUrl}`);

export {};
