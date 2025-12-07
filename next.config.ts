const withPWA = require("next-pwa")({
	dest: "public",
	register: true,
	skipWaiting: true,
	disable: process.env.NODE_ENV === "development", // Disable PWA in development
	runtimeCaching: [
		{
			urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "google-fonts",
				expiration: {
					maxEntries: 4,
					maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
				},
			},
		},
		{
			urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "google-fonts-static",
				expiration: {
					maxEntries: 4,
					maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
				},
			},
		},
		{
			urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-font-assets",
				expiration: {
					maxEntries: 4,
					maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
				},
			},
		},
		{
			urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-image-assets",
				expiration: {
					maxEntries: 64,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
		{
			urlPattern: /\/_next\/image\?url=.+$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "next-image",
				expiration: {
					maxEntries: 64,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
		{
			urlPattern: /\.(?:mp3|wav|ogg)$/i,
			handler: "CacheFirst",
			options: {
				rangeRequests: true,
				cacheName: "static-audio-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
		{
			urlPattern: /\.(?:mp4)$/i,
			handler: "CacheFirst",
			options: {
				rangeRequests: true,
				cacheName: "static-video-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
		{
			urlPattern: /\.(?:js)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-js-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
		{
			urlPattern: /\.(?:css|less)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-style-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
		{
			urlPattern: /^https:\/\/.*\.(?:json)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "json-cache",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
			},
		},
		{
			urlPattern: /\/api\/.*$/i,
			handler: "NetworkFirst",
			method: "GET",
			options: {
				cacheName: "apis",
				expiration: {
					maxEntries: 16,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
				networkTimeoutSeconds: 10, // Fall back to cache if network request takes longer than 10 seconds
			},
		},
		{
			urlPattern: /.*/i,
			handler: "NetworkFirst",
			options: {
				cacheName: "others",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 24 * 60 * 60, // 24 hours
				},
				networkTimeoutSeconds: 10,
			},
		},
	],
});

module.exports = withPWA({
	// Configuration for subdirectory deployment
	// Use direct env access for build-time configuration
	basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
	assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
	trailingSlash: true,
	// Explicitly use webpack for builds (required for next-pwa)
	turbopack: {},
});
