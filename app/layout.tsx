import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import ClientBody from "./ClientBody";
import Footer from "@/components/Footer";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Fête de la Musique Paris 2025",
	description:
		"Interactive map of music events across Paris arrondissements for Fête de la Musique 2025",
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
			<body suppressHydrationWarning className="antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<ClientBody>{children}</ClientBody>
					<Footer />
				</ThemeProvider>
			</body>
		</html>
	);
}
