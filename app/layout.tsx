import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { AuthProvider } from "@/context/auth-context";
import { VignetteAd } from "@/features/vignette-ad/components/vignette-ad";
import {
	USER_AUTH_COOKIE_NAME,
	getUserSessionFromCookieHeader,
} from "@/lib/auth/user-session-cookie";
import { generateMainOGImage } from "@/lib/social/og-utils";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "next-themes";
import { BodyClassHandler } from "@/components/body-class-handler";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { cookies } from "next/headers";

// Get base path from environment variable - use direct access for build-time
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Get the site URL from environment or default to localhost for development
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
	title: {
		default: "Fête Finder - Out Of Office Collective",
		template: "%s | Fête Finder - OOOC",
	},
	description:
		"Interactive map of music events across Paris arrondissements for Fête de la Musique 2025. Discover live music performances, street concerts, and cultural events happening during the annual French music celebration.",
	keywords: [
		"Fête de la Musique",
		"Paris music events",
		"live music Paris",
		"street concerts",
		"music festival Paris",
		"Out Of Office Collective",
		"OOOC",
		"interactive map",
		"2025 events",
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
		title: "Fête Finder - Interactive Paris Music Events Map",
		description:
			"Discover live music events across all Paris arrondissements during Fête de la Musique 2025. Interactive map with real-time event updates from Out Of Office Collective.",
		siteName: "Fête Finder - OOOC",
		images: [
			{
				url: generateMainOGImage(),
				width: 1200,
				height: 630,
				alt: "Fête Finder - Interactive map showing music events across Paris for Fête de la Musique 2025",
				type: "image/png",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Fête Finder - Interactive Paris Music Events Map",
		description:
			"Discover live music events across Paris arrondissements during Fête de la Musique 2025. Interactive map with real-time updates.",
		site: "@OutOfOfficeCol", // Replace with your actual Twitter handle
		creator: "@OutOfOfficeCol", // Replace with your actual Twitter handle
		images: [
			{
				url: generateMainOGImage(),
				alt: "Fête Finder - Interactive map showing music events across Paris for Fête de la Musique 2025",
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

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const cookieStore = await cookies();
	const userSession = getUserSessionFromCookieHeader(
		cookieStore.get(USER_AUTH_COOKIE_NAME)?.value,
	);

	return (
		<html
			lang="en"
			className={`${GeistSans.variable} ${GeistMono.variable}`}
			suppressHydrationWarning
		>
			<head>
				{/* PWA Manifest */}
				<link rel="manifest" href="/manifest.json" />
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
					content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=no, viewport-fit=cover"
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
			</head>
			<body suppressHydrationWarning className="antialiased">
				<BodyClassHandler />
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<AuthProvider
						initialIsAuthenticated={userSession.isAuthenticated}
						initialUserEmail={userSession.email}
					>
						{children}
						<Footer />
						<VignetteAd />
						<OfflineIndicator />
						<PWAInstallPrompt />
					</AuthProvider>
				</ThemeProvider>
				<Analytics />
			</body>
		</html>
	);
}
