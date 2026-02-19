import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { DevServiceWorkerReset } from "@/components/DevServiceWorkerReset";
import { SupportCoffeePrompt } from "@/components/SupportCoffeePrompt";
import { ThemeColorSync } from "@/components/ThemeColorSync";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { AuthProvider } from "@/features/auth/auth-context";
import { CommunityInvite } from "@/features/social/components/CommunityInvite";
import { generateMainOGImage } from "@/lib/social/og-utils";
import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";

// Get base path from environment variable - use direct access for build-time
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Get the site URL from environment or default to localhost for development
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
				alt: "Fête Finder - Interactive map showing music events across Paris for Fête de la Musique 2025",
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

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${GeistSans.variable} ${GeistMono.variable}`}
			suppressHydrationWarning
		>
			<head>
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
					<DevServiceWorkerReset />
					<ThemeColorSync />
					<AuthProvider>
						{children}
						<Footer />
						<SupportCoffeePrompt />
						<CommunityInvite />
						<OfflineIndicator />
						<PWAInstallPrompt />
					</AuthProvider>
				</ThemeProvider>
				<Analytics />
			</body>
		</html>
	);
}
