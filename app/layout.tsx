import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import ClientBody from "./ClientBody";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth-context";
import { generateMainOGImage } from "@/lib/og-utils";
import { Analytics } from "@vercel/analytics/next";
import { VignetteAd } from "@/features/vignette-ad/components/vignette-ad";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

// Get base path from environment variable
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

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable}`}
			suppressHydrationWarning
		>
			<head>
				<link
					rel="icon"
					href={`${basePath}/OOOCLogoDark.svg`}
					type="image/svg+xml"
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href={`${basePath}/OOOCLogoDark.svg`}
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href={`${basePath}/OOOCLogoDark.svg`}
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href={`${basePath}/OOOCLogoDark.svg`}
				/>
				<link
					rel="mask-icon"
					href={`${basePath}/OOOCLogoDark.svg`}
					color="#000000"
				/>
				<meta
					name="msapplication-TileImage"
					content={`${basePath}/OOOCLogoDark.svg`}
				/>
			</head>
			<body suppressHydrationWarning className="antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<AuthProvider>
						<ClientBody>{children}</ClientBody>
						<Footer />
						<VignetteAd />
					</AuthProvider>
				</ThemeProvider>
				<Analytics />
			</body>
		</html>
	);
}
