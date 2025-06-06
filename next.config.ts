import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Configuration for subdirectory deployment
	basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
	assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
	trailingSlash: true,
};

export default nextConfig;
