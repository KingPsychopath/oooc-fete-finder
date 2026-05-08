import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(
	/\/$/,
	"",
);
const eventPath =
	process.env.EVENT_PATH ||
	"/event/evt_115811d709b9b6ed/krispy-jam-n-29-tascha";
const maxEventHtmlBytes = Number(process.env.MAX_EVENT_HTML_BYTES || 120_000);
const maxHomeHtmlBytes = Number(process.env.MAX_HOME_HTML_BYTES || 360_000);
const maxChunkBytes = Number(process.env.MAX_JS_CHUNK_BYTES || 1_250_000);
const maxTotalChunkBytes = Number(
	process.env.MAX_TOTAL_JS_CHUNK_BYTES || 5_000_000,
);

const failures = [];

const fail = (message) => {
	failures.push(message);
	console.error(`✕ ${message}`);
};

const pass = (message) => {
	console.log(`✓ ${message}`);
};

const byteLength = (value) => Buffer.byteLength(value, "utf8");

const fetchText = async (pathname) => {
	const startedAt = performance.now();
	const response = await fetch(`${baseUrl}${pathname}`, {
		headers: { "user-agent": "oooc-route-check/1.0" },
	});
	const text = await response.text();
	return {
		headers: response.headers,
		ok: response.ok,
		status: response.status,
		text,
		timeMs: Math.round(performance.now() - startedAt),
	};
};

const assertIncludes = (html, needle, label) => {
	if (html.includes(needle)) {
		pass(label);
	} else {
		fail(label);
	}
};

const assertExcludes = (html, needle, label) => {
	if (!html.includes(needle)) {
		pass(label);
	} else {
		fail(label);
	}
};

const checkPublicHtml = async () => {
	console.log(`Checking public routes at ${baseUrl}`);

	const firstEvent = await fetchText(eventPath);
	const secondEvent = await fetchText(eventPath);
	if (!firstEvent.ok) {
		fail(`event route returned HTTP ${firstEvent.status}`);
	}
	if (!secondEvent.ok) {
		fail(`event route repeat returned HTTP ${secondEvent.status}`);
	}

	const eventBytes = byteLength(secondEvent.text);
	if (eventBytes <= maxEventHtmlBytes) {
		pass(`event HTML budget ${eventBytes}/${maxEventHtmlBytes} bytes`);
	} else {
		fail(`event HTML budget ${eventBytes}/${maxEventHtmlBytes} bytes`);
	}

	const cacheControl = secondEvent.headers.get("cache-control") || "";
	if (cacheControl.includes("s-maxage=")) {
		pass(`event route has ISR cache-control (${cacheControl})`);
	} else {
		fail(`event route missing ISR cache-control (${cacheControl || "none"})`);
	}

	assertIncludes(
		secondEvent.text,
		"Krispy Jam N°29 - Tascha",
		"event route includes selected event title",
	);
	assertIncludes(
		secondEvent.text,
		"Browse all events",
		"event route includes no-JS/server preview action",
	);
	assertExcludes(
		secondEvent.text,
		"initialEvents",
		"event route does not serialize homepage event list",
	);
	assertExcludes(
		secondEvent.text,
		"Discover events across the city",
		"event route does not render homepage discovery surface",
	);

	const home = await fetchText("/");
	if (!home.ok) {
		fail(`homepage returned HTTP ${home.status}`);
	}
	const homeBytes = byteLength(home.text);
	if (homeBytes <= maxHomeHtmlBytes) {
		pass(`homepage HTML budget ${homeBytes}/${maxHomeHtmlBytes} bytes`);
	} else {
		fail(`homepage HTML budget ${homeBytes}/${maxHomeHtmlBytes} bytes`);
	}
	assertIncludes(
		home.text,
		"event-map",
		"homepage includes event discovery map anchor",
	);

	console.log(
		`Timings: event first ${firstEvent.timeMs}ms, event repeat ${secondEvent.timeMs}ms, home ${home.timeMs}ms`,
	);
};

const collectJsChunks = async (directory) => {
	const entries = await readdir(directory, { withFileTypes: true });
	const chunks = [];
	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			chunks.push(...(await collectJsChunks(fullPath)));
			continue;
		}
		if (!entry.name.endsWith(".js")) continue;
		const stats = await stat(fullPath);
		chunks.push({ file: fullPath, size: stats.size });
	}
	return chunks;
};

const checkChunkBudgets = async () => {
	const chunksDirectory = path.join(process.cwd(), ".next", "static", "chunks");
	let chunks = [];
	try {
		chunks = await collectJsChunks(chunksDirectory);
	} catch {
		console.warn("Skipping chunk budget check; .next/static/chunks not found.");
		return;
	}

	const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
	const largestChunks = chunks
		.slice()
		.sort((left, right) => right.size - left.size)
		.slice(0, 8);

	if (totalBytes <= maxTotalChunkBytes) {
		pass(`total JS chunk budget ${totalBytes}/${maxTotalChunkBytes} bytes`);
	} else {
		fail(`total JS chunk budget ${totalBytes}/${maxTotalChunkBytes} bytes`);
	}

	const overBudgetChunks = chunks.filter((chunk) => chunk.size > maxChunkBytes);
	if (overBudgetChunks.length === 0) {
		pass(`no JS chunk exceeds ${maxChunkBytes} bytes`);
	} else {
		for (const chunk of overBudgetChunks) {
			fail(`${chunk.file} is ${chunk.size} bytes over chunk budget`);
		}
	}

	console.log("Largest JS chunks:");
	for (const chunk of largestChunks) {
		console.log(`- ${path.relative(process.cwd(), chunk.file)} ${chunk.size} bytes`);
	}
};

await checkPublicHtml();
await checkChunkBudgets();

if (failures.length > 0) {
	console.error(`\n${failures.length} public route check(s) failed.`);
	process.exitCode = 1;
} else {
	console.log("\nPublic route checks passed.");
}
