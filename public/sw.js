const CACHE_VERSION = "oooc-fete-finder-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}:app-shell`;
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const SAME_ORIGIN_CACHEABLE_DESTINATIONS = new Set([
	"font",
	"image",
	"script",
	"style",
]);

const APP_SHELL_URLS = ["/", "/manifest.json"];

const withScopePath = (path) => {
	const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
	if (!scopePath) return path;
	return `${scopePath}${path === "/" ? "" : path}`;
};

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

const fetchAndCache = async (request, cacheName) => {
	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(cacheName);
		await cache.put(request, response.clone());
	}
	return response;
};

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

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

	if (
		url.pathname.startsWith("/_next/static/") ||
		SAME_ORIGIN_CACHEABLE_DESTINATIONS.has(request.destination)
	) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				return cachedResponse || fetchAndCache(request, STATIC_CACHE);
			}),
		);
	}
});
