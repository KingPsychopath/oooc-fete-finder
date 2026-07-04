import { isOffseasonPlaceholderEnabled } from "@/lib/offseason-placeholder";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.[a-zA-Z0-9]+$/;
const PUBLIC_PREFIXES = [
	"/_next/",
	"/fonts/",
	"/icons/",
	"/maps/",
	"/media-kit/",
	"/og/",
];
const PUBLIC_PATHS = new Set([
	"/favicon.ico",
	"/favicon.png",
	"/favicon.svg",
	"/favicon-16x16.png",
	"/favicon-32x32.png",
	"/favicon-48x48.png",
	"/apple-touch-icon.png",
	"/apple-touch-icon-precomposed.png",
	"/apple-touch-icon-120x120.png",
	"/OOOCLogoDark.svg",
	"/OOOCLogoLight.svg",
	"/grain.png",
	"/manifest.json",
	"/manifest.webmanifest",
	"/robots.txt",
	"/sitemap.xml",
]);

function isPublicAsset(pathname: string) {
	return (
		PUBLIC_PATHS.has(pathname) ||
		PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
		PUBLIC_FILE.test(pathname)
	);
}

export function proxy(request: NextRequest) {
	if (!isOffseasonPlaceholderEnabled()) {
		return NextResponse.next();
	}

	const { pathname } = request.nextUrl;
	if (pathname === "/" || isPublicAsset(pathname)) {
		return NextResponse.next();
	}

	const url = request.nextUrl.clone();
	url.pathname = "/";
	url.search = "";
	return NextResponse.redirect(url, 302);
}
