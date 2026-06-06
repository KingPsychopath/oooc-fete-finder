import type { Metadata } from "next";
import "./globals.css";
import { AppSettingsSync } from "@/components/AppSettingsSync";
import { FirstPartyAnalytics } from "@/components/FirstPartyAnalytics";
import Footer from "@/components/Footer";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { SmoothAnchorScroll } from "@/components/SmoothAnchorScroll";
import { SupportCoffeePrompt } from "@/components/SupportCoffeePrompt";
import { ThemeColorSync } from "@/components/ThemeColorSync";
import { UserNoticeCenter } from "@/components/UserNoticeCenter";
import { OfflineIndicator } from "@/components/offline-indicator";
import { OnlineStatusProvider } from "@/components/online-status-gate";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { AuthProvider } from "@/features/auth/auth-context";
import { CommunityInvite } from "@/features/social/components/CommunityInvite";
import { getSiteUrl } from "@/lib/site-url";
import { generateMainOGImage } from "@/lib/social/og-utils";
import { ThemeProvider } from "next-themes";
import localFont from "next/font/local";

// Get base path from environment variable - use direct access for build-time
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Get the site URL from environment or default to localhost for development
const siteUrl = getSiteUrl();
const siteStructuredData = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "WebSite",
			"@id": `${siteUrl}/#website`,
			url: siteUrl,
			name: "Fête Finder",
			description: "Curated Paris music events by Out Of Office Collective.",
			publisher: {
				"@id": `${siteUrl}/#organization`,
			},
		},
		{
			"@type": "Organization",
			"@id": `${siteUrl}/#organization`,
			name: "Out Of Office Collective",
			url: "https://www.outofofficecollective.co.uk/",
			logo: `${siteUrl}/OOOCLogoDark.svg`,
			sameAs: [
				"https://www.instagram.com/outofofficecollectivee/",
				"https://www.tiktok.com/@outofofficecollective",
			],
		},
	],
};
const siteStructuredDataJson = JSON.stringify(siteStructuredData).replace(
	/</g,
	"\\u003c",
);
const assetRecoveryScript = `
(function () {
	var RECOVERY_KEY = "oooc:static-asset-recovery:v1";
	var RECOVERY_WINDOW_MS = 30000;
	var CACHE_PREFIX = "oooc-fete-finder-";
	var STATIC_PATH = "/_next/static/";

	function isNextStaticAssetUrl(value) {
		if (typeof value !== "string" || value.length === 0) return false;
		try {
			return new URL(value, window.location.href).pathname.indexOf(STATIC_PATH) !== -1;
		} catch (error) {
			return value.indexOf(STATIC_PATH) !== -1;
		}
	}

	function errorText(value) {
		if (!value) return "";
		if (typeof value === "string") return value;
		return [value.name, value.message, value.stack].filter(Boolean).join(" ");
	}

	function isStaticChunkError(value) {
		var text = errorText(value);
		return (
			text.indexOf("ChunkLoadError") !== -1 ||
			text.indexOf("Loading chunk") !== -1 ||
			isNextStaticAssetUrl(text)
		);
	}

	function hasRecentlyRecovered() {
		try {
			var recoveredAt = Number(window.sessionStorage.getItem(RECOVERY_KEY) || "0");
			return Date.now() - recoveredAt < RECOVERY_WINDOW_MS;
		} catch (error) {
			return false;
		}
	}

	function markRecovered() {
		try {
			window.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
		} catch (error) {}
	}

	function clearServiceWorkerCaches() {
		if (!("caches" in window)) return Promise.resolve();
		return caches.keys().then(function (cacheNames) {
			return Promise.all(
				cacheNames
					.filter(function (cacheName) {
						return cacheName.indexOf(CACHE_PREFIX) === 0;
					})
					.map(function (cacheName) {
						return caches.delete(cacheName);
					}),
			);
		});
	}

	function updateServiceWorkers() {
		if (!("serviceWorker" in navigator)) return Promise.resolve();
		return navigator.serviceWorker.getRegistrations().then(function (registrations) {
			return Promise.all(
				registrations.map(function (registration) {
					return registration.update().catch(function () {});
				}),
			);
		});
	}

	function recoverFromMissingStaticAsset() {
		if (navigator.onLine === false || hasRecentlyRecovered()) return;
		markRecovered();
		Promise.all([
			clearServiceWorkerCaches().catch(function () {}),
			updateServiceWorkers().catch(function () {}),
		]).then(function () {
			window.location.reload();
		});
	}

	window.addEventListener(
		"error",
		function (event) {
			var target = event.target;
			var url = target && (target.src || target.href);
			if (isNextStaticAssetUrl(url) || isStaticChunkError(event.error || event.message)) {
				recoverFromMissingStaticAsset();
			}
		},
		true,
	);

	window.addEventListener("unhandledrejection", function (event) {
		if (isStaticChunkError(event.reason)) recoverFromMissingStaticAsset();
	});

	if ("serviceWorker" in navigator) {
		navigator.serviceWorker.addEventListener("message", function (event) {
			if (event.data && event.data.type === "MISSING_STATIC_ASSET") {
				recoverFromMissingStaticAsset();
			}
		});
	}
})();
`.replace(/<\/script/gi, "<\\/script");

const degular = localFont({
	src: "../public/fonts/degular_regular.woff2",
	weight: "400",
	style: "normal",
	display: "swap",
	variable: "--font-degular",
});

const prata = localFont({
	src: "../public/fonts/prata_regular.woff2",
	weight: "400",
	style: "normal",
	display: "swap",
	variable: "--font-prata",
});

export const metadata: Metadata = {
	title: {
		default: "Fête Finder | Out Of Office Collective",
		template: "%s | Fête Finder",
	},
	description:
		"Curated map of Paris music events by Out Of Office Collective. Discover live performances, save your picks, and plan your Fête Finder route.",
	keywords: [
		"Fête de la Musique",
		"Paris music events",
		"live music Paris",
		"street concerts",
		"music festival Paris",
		"Out Of Office Collective",
		"OOOC",
		"interactive map",
		"curated event guide",
	],
	authors: [{ name: "Out Of Office Collective" }],
	creator: "Out Of Office Collective",
	publisher: "Out Of Office Collective",
	metadataBase: new URL(siteUrl),
	alternates: {
		canonical: "/",
	},
	openGraph: {
		type: "website",
		locale: "en_US",
		url: siteUrl,
		title: "Fête Finder | Out Of Office Collective",
		description:
			"Curated Paris music events, editorial picks, and live updates from Out Of Office Collective.",
		siteName: "Fête Finder",
		images: [
			{
				url: generateMainOGImage(),
				width: 1200,
				height: 630,
				alt: "Fête Finder - Curated music events across Paris for Fête de la Musique",
				type: "image/png",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Fête Finder | Out Of Office Collective",
		description:
			"Curated Paris music events, editorial picks, and live updates from Out Of Office Collective.",
		site: "@OutOfOfficeCol",
		creator: "@OutOfOfficeCol",
		images: [
			{
				url: generateMainOGImage(),
				alt: "Fête Finder - Curated music events across Paris for Fête de la Musique",
			},
		],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	verification: {
		// Add your verification codes when available
		// google: "your-google-verification-code",
		// yandex: "your-yandex-verification-code",
		// yahoo: "your-yahoo-verification-code",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${degular.variable} ${prata.variable}`}
			style={{ backgroundColor: "var(--background, #f6f3ee)" }}
			suppressHydrationWarning
		>
			<head>
				<script dangerouslySetInnerHTML={{ __html: assetRecoveryScript }} />
				{/* PWA Manifest */}
				<link rel="manifest" href={`${basePath}/manifest.webmanifest`} />
				<meta name="theme-color" content="#000000" />
				<meta name="background-color" content="#ffffff" />

				{/* PWA Meta Tags */}
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
				<meta name="apple-mobile-web-app-title" content="Fête Finder" />
				<meta name="msapplication-TileColor" content="#000000" />
				<meta name="msapplication-tap-highlight" content="no" />

				{/* Viewport for PWA */}
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
				/>

				{/* Favicon links */}
				<link
					rel="icon"
					href={`${basePath}/favicon.svg`}
					type="image/svg+xml"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href={`${basePath}/favicon-32x32.png`}
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href={`${basePath}/favicon-16x16.png`}
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href={`${basePath}/icons/icon-192x192.png`}
				/>
				<link
					rel="mask-icon"
					href={`${basePath}/favicon.svg`}
					color="#000000"
				/>
				<meta
					name="msapplication-TileImage"
					content={`${basePath}/icons/icon-192x192.png`}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: siteStructuredDataJson }}
				/>
			</head>
			<body
				suppressHydrationWarning
				className="antialiased"
				style={{ backgroundColor: "var(--background, #f6f3ee)" }}
			>
				<a
					href="#main-content"
					className="sr-only rounded-md border-2 border-foreground bg-background px-4 py-2 text-sm font-medium text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Skip to main content
				</a>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<SmoothAnchorScroll />
					<ServiceWorkerRegistration />
					<ThemeColorSync />
					<FirstPartyAnalytics />
					<OnlineStatusProvider>
						<AuthProvider>
							<AppSettingsSync />
							{children}
							<UserNoticeCenter />
							<Footer />
							<MobileBottomNav />
							<SupportCoffeePrompt />
							<CommunityInvite />
							<OfflineIndicator />
							<PWAInstallPrompt />
						</AuthProvider>
					</OnlineStatusProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
