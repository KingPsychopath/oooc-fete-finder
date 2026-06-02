const CACHE_VERSION = "oooc-fete-finder-v6";
const APP_SHELL_CACHE = `${CACHE_VERSION}:app-shell`;
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const SAFE_API_CACHE = `${CACHE_VERSION}:safe-api`;
const STATIC_CACHE_PATH_PREFIXES = ["/_next/static/", "/fonts/", "/favicon"];
const SAME_ORIGIN_CACHEABLE_DESTINATIONS = new Set([
	"font",
	"image",
	"script",
	"style",
]);

const APP_SHELL_URLS = ["/", "/manifest.webmanifest"];
const SENSITIVE_PATH_PREFIXES = [
	"/admin",
	"/api/admin",
	"/api/auth",
	"/api/cron",
	"/api/revalidate",
	"/api/user",
	"/api/webhooks",
	"/partner-stats",
];
const NETWORK_ONLY_EXACT_PATHS = new Set(["/api/client-health"]);

const withScopePath = (path) => {
	const scopePath = new URL(self.registration.scope).pathname.replace(
		/\/$/,
		"",
	);
	if (!scopePath) return path;
	return `${scopePath}${path === "/" ? "" : path}`;
};

const getPathWithoutScope = (pathname) => {
	const scopePath = new URL(self.registration.scope).pathname.replace(
		/\/$/,
		"",
	);
	if (!scopePath || !pathname.startsWith(scopePath)) return pathname;
	const nextPath = pathname.slice(scopePath.length);
	return nextPath || "/";
};

const isSensitivePath = (pathname) =>
	SENSITIVE_PATH_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);

const isSafeApiPath = (pathname) => {
	return /^\/api\/events\/[^/]+$/.test(pathname);
};

const isStaticAssetPath = (pathname) =>
	STATIC_CACHE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const isNextStaticAssetPath = (pathname) =>
	pathname.startsWith("/_next/static/");

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(APP_SHELL_CACHE)
			.then((cache) => cache.addAll(APP_SHELL_URLS.map(withScopePath)))
			.catch(() => undefined),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) =>
				Promise.all(
					cacheNames
						.filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
						.map((cacheName) => caches.delete(cacheName)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

const isCacheableResponse = (response) => {
	if (!response || !response.ok) return false;
	const cacheControl = response.headers.get("Cache-Control") || "";
	return !/(^|,\s*)(no-store|private)(\s*,|$)/i.test(cacheControl);
};

const fetchAndCache = async (request, cacheName) => {
	const response = await fetch(request);
	if (isCacheableResponse(response)) {
		const cache = await caches.open(cacheName);
		await cache.put(request, response.clone());
	}
	return response;
};

const cacheStaticUrls = async (urls) => {
	const cache = await caches.open(STATIC_CACHE);
	await Promise.all(
		urls.map(async (url) => {
			try {
				const requestUrl = new URL(url, self.location.origin);
				if (requestUrl.origin !== self.location.origin) return;
				const pathname = getPathWithoutScope(requestUrl.pathname);
				if (!isStaticAssetPath(pathname)) return;
				const request = new Request(requestUrl.href, {
					credentials: "same-origin",
				});
				const response = await fetch(request);
				if (isCacheableResponse(response)) {
					await cache.put(request, response);
				}
			} catch {
				// Static cache seeding is best-effort; runtime caching still applies.
			}
		}),
	);
};

self.addEventListener("message", (event) => {
	if (event.data?.type === "GET_OFFLINE_STATUS") {
		event.ports?.[0]?.postMessage({
			type: "OFFLINE_STATUS",
			cacheVersion: CACHE_VERSION,
			cacheNames: {
				appShell: APP_SHELL_CACHE,
				static: STATIC_CACHE,
				safeApi: SAFE_API_CACHE,
			},
		});
		return;
	}

	if (event.data?.type !== "CACHE_STATIC_URLS") return;
	if (!Array.isArray(event.data.urls)) return;

	event.waitUntil(cacheStaticUrls(event.data.urls));
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	const pathname = getPathWithoutScope(url.pathname);
	if (NETWORK_ONLY_EXACT_PATHS.has(pathname)) return;
	if (isSensitivePath(pathname)) return;

	if (request.mode === "navigate") {
		event.respondWith(
			fetchAndCache(request, APP_SHELL_CACHE).catch(async () => {
				const cache = await caches.open(APP_SHELL_CACHE);
				return (
					(await cache.match(request)) ||
					(await cache.match(withScopePath("/"))) ||
					Response.error()
				);
			}),
		);
		return;
	}

	if (isSafeApiPath(pathname)) {
		event.respondWith(
			fetchAndCache(request, SAFE_API_CACHE).catch(async () => {
				const cache = await caches.open(SAFE_API_CACHE);
				return (await cache.match(request)) || Response.error();
			}),
		);
		return;
	}

	if (isNextStaticAssetPath(pathname)) {
		event.respondWith(
			fetchAndCache(request, STATIC_CACHE).catch(async () => {
				const cache = await caches.open(STATIC_CACHE);
				return (await cache.match(request)) || Response.error();
			}),
		);
		return;
	}

	if (
		isStaticAssetPath(pathname) ||
		SAME_ORIGIN_CACHEABLE_DESTINATIONS.has(request.destination)
	) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				if (cachedResponse) return cachedResponse;
				return fetchAndCache(request, STATIC_CACHE).catch(() =>
					Response.error(),
				);
			}),
		);
	}
});
