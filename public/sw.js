const CACHE_VERSION = "oooc-fete-finder-v10";
const CACHE_PREFIX = "oooc-fete-finder-";
const PAGE_CACHE = `${CACHE_VERSION}:pages`;
const PAGE_METADATA_CACHE = `${CACHE_VERSION}:page-metadata`;
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const SAFE_API_CACHE = `${CACHE_VERSION}:safe-api`;
const OFFLINE_FALLBACK_PATH = "/offline.html";
const PRECACHE_PATHS = [
	OFFLINE_FALLBACK_PATH,
	"/favicon.svg",
	"/icons/icon-192x192.png",
];
const STATIC_CACHE_PATH_PREFIXES = ["/fonts/", "/favicon", "/icons/"];
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
const NEXT_STATIC_ASSET_PATTERN = /\\?\/_next\/static\/[^"'`\s<>\\)]+/g;

const getScopedUrl = (path) =>
	new URL(path.replace(/^\//, ""), self.registration.scope).href;

const getPathWithoutScope = (pathname) => {
	const scopePath = new URL(self.registration.scope).pathname.replace(
		/\/$/,
		"",
	);
	if (!scopePath || !pathname.startsWith(scopePath)) return pathname;
	const nextPath = pathname.slice(scopePath.length);
	return nextPath || "/";
};

const metadataRequestFor = (url) =>
	new Request(
		new URL(
			`/__oooc-sw/page-metadata?url=${encodeURIComponent(url)}`,
			self.location.origin,
		).href,
	);

const isSensitivePath = (pathname) =>
	SENSITIVE_PATH_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);

const isSafeApiPath = (pathname) => /^\/api\/events\/[^/]+$/.test(pathname);

const isStaticAssetPath = (pathname) =>
	STATIC_CACHE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const isNextStaticAssetPath = (pathname) =>
	pathname.startsWith("/_next/static/");

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

const createRequest = (url) =>
	new Request(url, {
		credentials: "same-origin",
	});

const normalizeSameOriginAssetUrl = (value, baseUrl) => {
	try {
		const normalizedValue = value.replace(/\\\//g, "/");
		const url = new URL(normalizedValue, baseUrl);
		if (url.origin !== self.location.origin) return null;
		const pathname = getPathWithoutScope(url.pathname);
		return isNextStaticAssetPath(pathname) ? url.href : null;
	} catch {
		return null;
	}
};

const extractNextStaticAssetUrls = (html, baseUrl) => {
	const urls = new Set();
	for (const match of html.matchAll(NEXT_STATIC_ASSET_PATTERN)) {
		const url = normalizeSameOriginAssetUrl(match[0], baseUrl);
		if (url) urls.add(url);
	}
	return [...urls];
};

const notifyMissingStaticAsset = async (request) => {
	const clients = await self.clients.matchAll({
		includeUncontrolled: true,
		type: "window",
	});
	for (const client of clients) {
		client.postMessage({
			type: "MISSING_STATIC_ASSET",
			cacheVersion: CACHE_VERSION,
			url: request.url,
		});
	}
};

const fetchCacheFirst = async (request, cacheName) => {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);
	if (cachedResponse) return cachedResponse;

	const response = await fetch(request);
	if (isCacheableResponse(response)) {
		await cache.put(request, response.clone());
		return response;
	}

	const pathname = getPathWithoutScope(new URL(request.url).pathname);
	if (response.status === 404 && isNextStaticAssetPath(pathname)) {
		void notifyMissingStaticAsset(request);
	}
	return response;
};

const fetchNetworkFirst = async (request, cacheName) => {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (isCacheableResponse(response)) {
			await cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cachedResponse = await cache.match(request);
		if (cachedResponse) return cachedResponse;
		throw error;
	}
};

const cacheStaticUrl = async (url) => {
	const request = createRequest(url);
	const response = await fetchCacheFirst(request, STATIC_CACHE);
	return response.ok;
};

const precacheStaticAssets = async () => {
	const cache = await caches.open(STATIC_CACHE);
	await Promise.all(
		PRECACHE_PATHS.map(async (path) => {
			try {
				const request = createRequest(getScopedUrl(path));
				const response = await fetch(request, { cache: "reload" });
				if (response.ok) {
					await cache.put(request, response);
				}
			} catch {
				// Precache is best-effort; runtime fetches still handle fallbacks.
			}
		}),
	);
};

const cacheNavigationSnapshot = async (request, response) => {
	if (!isCacheableNavigationResponse(response)) return;

	const html = await response.clone().text();
	const assetUrls = extractNextStaticAssetUrls(html, request.url);
	if (assetUrls.length === 0) return;

	const assetResults = await Promise.allSettled(assetUrls.map(cacheStaticUrl));
	const hasEveryAsset = assetResults.every(
		(result) => result.status === "fulfilled" && result.value === true,
	);
	if (!hasEveryAsset) return;

	const [pageCache, metadataCache] = await Promise.all([
		caches.open(PAGE_CACHE),
		caches.open(PAGE_METADATA_CACHE),
	]);
	await Promise.all([
		pageCache.put(request, response.clone()),
		metadataCache.put(
			metadataRequestFor(request.url),
			new Response(
				JSON.stringify({
					assetUrls,
					cacheVersion: CACHE_VERSION,
					savedAt: new Date().toISOString(),
					url: request.url,
				}),
				{
					headers: {
						"Content-Type": "application/json; charset=utf-8",
					},
				},
			),
		),
	]);
};

const cacheNavigationUrl = async (value) => {
	try {
		if (typeof value !== "string") return;
		const url = new URL(value, self.location.origin);
		if (url.origin !== self.location.origin) return;

		const pathname = getPathWithoutScope(url.pathname);
		if (isSensitivePath(pathname)) return;

		const request = createRequest(url.href);
		const response = await fetch(request, { cache: "reload" });
		await cacheNavigationSnapshot(request, response);
	} catch {
		// Navigation snapshots are best-effort and never used for online loads.
	}
};

const getNavigationCacheCandidates = (request) => {
	const candidates = [request];
	const url = new URL(request.url);
	if (url.search || url.hash) {
		const withoutSearch = new URL(url.href);
		withoutSearch.search = "";
		withoutSearch.hash = "";
		candidates.push(createRequest(withoutSearch.href));
	}
	return candidates;
};

const hasCachedStaticAssets = async (assetUrls) => {
	if (!Array.isArray(assetUrls) || assetUrls.length === 0) return false;

	const cache = await caches.open(STATIC_CACHE);
	for (const assetUrl of assetUrls) {
		if (typeof assetUrl !== "string") return false;
		const cachedResponse = await cache.match(createRequest(assetUrl));
		if (!cachedResponse) return false;
	}
	return true;
};

const getCoherentCachedNavigation = async (request) => {
	const [pageCache, metadataCache] = await Promise.all([
		caches.open(PAGE_CACHE),
		caches.open(PAGE_METADATA_CACHE),
	]);

	for (const candidate of getNavigationCacheCandidates(request)) {
		const [pageResponse, metadataResponse] = await Promise.all([
			pageCache.match(candidate),
			metadataCache.match(metadataRequestFor(candidate.url)),
		]);
		if (!pageResponse || !metadataResponse) continue;

		try {
			const metadata = await metadataResponse.json();
			if (metadata.cacheVersion !== CACHE_VERSION) continue;
			if (await hasCachedStaticAssets(metadata.assetUrls)) {
				return pageResponse;
			}
		} catch {
			// Ignore malformed metadata and continue to the fallback.
		}
	}
	return null;
};

const getOfflineFallbackResponse = async () => {
	const cache = await caches.open(STATIC_CACHE);
	const request = createRequest(getScopedUrl(OFFLINE_FALLBACK_PATH));
	const cachedResponse = await cache.match(request);
	if (cachedResponse) return cachedResponse;

	return new Response(
		`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fete Finder Offline</title><body><main><h1>Fete Finder is offline</h1><p>Reconnect to refresh the app. If you opened Fete Finder recently, return to that tab to keep browsing saved event data.</p></main></body></html>`,
		{
			headers: {
				"Content-Type": "text/html; charset=utf-8",
			},
			status: 503,
		},
	);
};

const handleNavigationRequest = async (event) => {
	const { request } = event;
	const url = new URL(request.url);
	const pathname = getPathWithoutScope(url.pathname);

	try {
		const response = await fetch(request);
		if (!isSensitivePath(pathname) && isCacheableNavigationResponse(response)) {
			event.waitUntil(cacheNavigationSnapshot(request, response.clone()));
		}
		return response;
	} catch {
		const cachedResponse = await getCoherentCachedNavigation(request);
		if (cachedResponse) return cachedResponse;
		return getOfflineFallbackResponse();
	}
};

self.addEventListener("install", (event) => {
	self.skipWaiting();
	event.waitUntil(precacheStaticAssets());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) =>
				Promise.all(
					cacheNames
						.filter(
							(cacheName) =>
								cacheName.startsWith(CACHE_PREFIX) &&
								!cacheName.startsWith(CACHE_VERSION),
						)
						.map((cacheName) => caches.delete(cacheName)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("message", (event) => {
	if (event.data?.type === "GET_OFFLINE_STATUS") {
		event.ports?.[0]?.postMessage({
			type: "OFFLINE_STATUS",
			cacheVersion: CACHE_VERSION,
			cacheNames: {
				pageMetadata: PAGE_METADATA_CACHE,
				pages: PAGE_CACHE,
				safeApi: SAFE_API_CACHE,
				static: STATIC_CACHE,
			},
			offlineFallbackPath: OFFLINE_FALLBACK_PATH,
		});
		return;
	}

	if (event.data?.type === "CACHE_CURRENT_NAVIGATION") {
		event.waitUntil(cacheNavigationUrl(event.data.url));
		return;
	}

	if (event.data?.type !== "CACHE_STATIC_URLS") return;
	if (!Array.isArray(event.data.urls)) return;

	event.waitUntil(
		Promise.allSettled(
			event.data.urls.map(async (url) => {
				const requestUrl = new URL(url, self.location.origin);
				if (requestUrl.origin !== self.location.origin) return;
				const pathname = getPathWithoutScope(requestUrl.pathname);
				if (!isStaticAssetPath(pathname) && !isNextStaticAssetPath(pathname)) {
					return;
				}
				await cacheStaticUrl(requestUrl.href);
			}),
		),
	);
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
		event.respondWith(handleNavigationRequest(event));
		return;
	}

	if (isSafeApiPath(pathname)) {
		event.respondWith(fetchNetworkFirst(request, SAFE_API_CACHE));
		return;
	}

	if (isNextStaticAssetPath(pathname)) {
		event.respondWith(
			fetchCacheFirst(request, STATIC_CACHE).catch(() => Response.error()),
		);
		return;
	}

	if (
		isStaticAssetPath(pathname) ||
		SAME_ORIGIN_CACHEABLE_DESTINATIONS.has(request.destination)
	) {
		event.respondWith(
			fetchCacheFirst(request, STATIC_CACHE).catch(() => Response.error()),
		);
	}
});
