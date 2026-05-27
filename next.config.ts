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
		value:
			"camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()",
	},
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-DNS-Prefetch-Control", value: "on" },
	{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
	// Configuration for subdirectory deployment
	// Use direct env access for build-time configuration
	basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
	assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
	reactStrictMode: true,
	trailingSlash: false,
	outputFileTracingIncludes: {
		"/*": ["./data/events.csv", "./public/fonts/Geist-Regular.ttf"],
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
		];
	},
	turbopack: {},
};

export default nextConfig;
