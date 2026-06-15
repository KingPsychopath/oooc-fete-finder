import type { NextConfig } from "next";

const securityHeaders = [
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"base-uri 'self'",
			"object-src 'none'",
			"frame-ancestors 'none'",
			"form-action 'self'",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data:",
			"style-src 'self' 'unsafe-inline'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"connect-src 'self' https://tiles.openfreemap.org",
			"worker-src 'self' blob:",
			"manifest-src 'self'",
			"upgrade-insecure-requests",
		].join("; "),
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
	},
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-DNS-Prefetch-Control", value: "on" },
	{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const fontCacheHeaders = [
	{
		key: "Cache-Control",
		value: "public, max-age=31536000, immutable",
	},
];

const immutableAssetCacheHeaders = [
	{
		key: "Cache-Control",
		value: "public, max-age=31536000, immutable",
	},
];

const publicAssetCacheHeaders = [
	{
		key: "Cache-Control",
		value: "public, max-age=86400, stale-while-revalidate=604800",
	},
];

const serviceWorkerHeaders = [
	{
		key: "Cache-Control",
		value: "no-store, no-cache, must-revalidate",
	},
];

const nextConfig: NextConfig = {
	// Configuration for subdirectory deployment
	// Use direct env access for build-time configuration
	basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
	assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
	reactStrictMode: true,
	serverExternalPackages: ["@resvg/resvg-js", "sharp"],
	trailingSlash: false,
	outputFileTracingIncludes: {
		"/*": [
			"./data/events.csv",
			"./public/fonts/degular_regular.woff2",
			"./public/fonts/prata_regular.woff2",
			"./public/fonts/degular_regular.ttf",
			"./public/fonts/prata_regular.ttf",
		],
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
			{
				source: "/fonts/:path*",
				headers: fontCacheHeaders,
			},
			{
				source: "/icons/:path*",
				headers: immutableAssetCacheHeaders,
			},
			{
				source: "/favicon.ico",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/favicon.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/favicon.svg",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/favicon-16x16.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/favicon-32x32.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/favicon-48x48.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/apple-touch-icon.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/apple-touch-icon-precomposed.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/apple-touch-icon-120x120.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/OOOCLogoDark.svg",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/OOOCLogoLight.svg",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/manifest.json",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/manifest.webmanifest",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/grain.png",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/maps/:path*",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/og/:path*",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/media-kit/:path*",
				headers: publicAssetCacheHeaders,
			},
			{
				source: "/sw.js",
				headers: serviceWorkerHeaders,
			},
			{
				source: "/offline.html",
				headers: serviceWorkerHeaders,
			},
		];
	},
	turbopack: {},
};

export default nextConfig;
