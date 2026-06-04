const CACHE_VERSION = "oooc-fete-finder-v8";
const APP_SHELL_CACHE = `${CACHE_VERSION}:app-shell`;
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const SAFE_API_CACHE = `${CACHE_VERSION}:safe-api`;
const STATIC_CACHE_PATH_PREFIXES = ["/fonts/", "/favicon"];
const NAVIGATION_CACHE_EXACT_PATHS = new Set([
	"/",
	"/feature-event",
	"/how-it-works",
	"/partner-success",
	"/plans",
	"/privacy",
	"/social",
	"/social/square",
	"/social/story",
	"/social/twitter",
	"/submit-event",
	"/terms",
]);
const NAVIGATION_CACHE_PATH_PREFIXES = ["/event/"];
const SAME_ORIGIN_CACHEABLE_DESTINATIONS = new Set([
	"font",
	"image",
	"script",
	"style",
]);

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

const isCacheableNavigationPath = (pathname) =>
	NAVIGATION_CACHE_EXACT_PATHS.has(pathname) ||
	NAVIGATION_CACHE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

self.addEventListener("install", () => {
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

const isCacheableNavigationResponse = (response) => {
	if (!response || !response.ok) return false;
	const contentType = response.headers.get("Content-Type") || "";
	return contentType.toLowerCase().includes("text/html");
};

const fetchAndCache = async (request, cacheName) => {
	const response = await fetch(request);
	if (isCacheableResponse(response)) {
		const cache = await caches.open(cacheName);
		await cache.put(request, response.clone());
	}
	return response;
};

const fetchNextStaticAsset = async (request) => {
	const cache = await caches.open(STATIC_CACHE);
	const cachedResponse = await cache.match(request);

	try {
		const response = await fetch(request, { cache: "reload" });
		if (isCacheableResponse(response)) {
			await cache.put(request, response.clone());
			return response;
		}
		if (cachedResponse) return cachedResponse;
		return response;
	} catch (error) {
		if (cachedResponse) return cachedResponse;
		throw error;
	}
};

const fetchNavigation = async (request, pathname) => {
	const canCacheNavigation = isCacheableNavigationPath(pathname);
	const cache = canCacheNavigation ? await caches.open(APP_SHELL_CACHE) : null;

	try {
		const response = await fetch(request);
		if (cache && isCacheableNavigationResponse(response)) {
			await cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cachedResponse = cache ? await cache.match(request) : null;
		if (cachedResponse) return cachedResponse;
		throw error;
	}
};

const cacheNavigationUrl = async (url) => {
	try {
		const requestUrl = new URL(url, self.location.origin);
		if (requestUrl.origin !== self.location.origin) return;

		const pathname = getPathWithoutScope(requestUrl.pathname);
		if (!isCacheableNavigationPath(pathname) || isSensitivePath(pathname)) {
			return;
		}

		const request = new Request(requestUrl.href, {
			credentials: "same-origin",
		});
		const response = await fetch(request);
		if (!isCacheableNavigationResponse(response)) return;

		const cache = await caches.open(APP_SHELL_CACHE);
		await cache.put(request, response);
	} catch {
		// Navigation shell seeding is best-effort; normal navigation caching remains.
	}
};

const cacheStaticUrls = async (urls) => {
	await Promise.all(
		urls.map(async (url) => {
			try {
				const requestUrl = new URL(url, self.location.origin);
				if (requestUrl.origin !== self.location.origin) return;
				const pathname = getPathWithoutScope(requestUrl.pathname);
				if (!isStaticAssetPath(pathname) && !isNextStaticAssetPath(pathname)) {
					return;
				}
				const request = new Request(requestUrl.href, {
					credentials: "same-origin",
				});
				if (isNextStaticAssetPath(pathname)) {
					await fetchNextStaticAsset(request);
					return;
				}

				const cache = await caches.open(STATIC_CACHE);
				const response = await fetch(request, { cache: "reload" });
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

	if (event.data?.type === "CACHE_NAVIGATION_URL") {
		if (typeof event.data.url !== "string") return;
		event.waitUntil(cacheNavigationUrl(event.data.url));
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
			fetchNavigation(request, pathname).catch(() => Response.error()),
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
			fetchNextStaticAsset(request).catch(() => Response.error()),
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
