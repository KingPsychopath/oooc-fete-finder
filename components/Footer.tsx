import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { legalEntityName } from "@/lib/legal";
import { Croissant, ExternalLink, Globe } from "lucide-react";
import Link from "next/link";

const ooocWebsiteUrl =
	process.env.NEXT_PUBLIC_OOOC_WEBSITE_URL?.trim() ||
	"https://www.outofofficecollective.co.uk/";
const ooocInstagramUrl =
	process.env.NEXT_PUBLIC_OOOC_INSTAGRAM_URL?.trim() ||
	"https://www.instagram.com/outofofficecollectivee/";
const ooocTikTokUrl =
	process.env.NEXT_PUBLIC_OOOC_TIKTOK_URL?.trim() ||
	"https://www.tiktok.com/@outofofficecollective";
const ooocContactUrl =
	process.env.NEXT_PUBLIC_OOOC_CONTACT_URL?.trim() ||
	"https://outofofficecollective.co.uk/contact";
const ooocFaqUrl =
	process.env.NEXT_PUBLIC_OOOC_FAQ_URL?.trim() ||
	"https://outofofficecollective.co.uk/faqs";
const creatorXUrl =
	process.env.NEXT_PUBLIC_CREATOR_X_URL?.trim() || "https://x.com/milkandh3nny";
const supportCoffeeUrl =
	process.env.NEXT_PUBLIC_SUPPORT_COFFEE_URL?.trim() ||
	"https://coff.ee/milkandhenny";

// Custom Instagram icon component matching Instagram's brand symbol
const InstagramIcon = ({ className }: { className?: string }) => (
	<svg
		className={className}
		viewBox="0 0 24 24"
		fill="currentColor"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
	</svg>
);

// Custom TikTok icon component matching TikTok's brand symbol
const TikTokIcon = ({ className }: { className?: string }) => (
	<svg
		className={className}
		viewBox="0 0 24 24"
		fill="currentColor"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5.12 20.14a6.34 6.34 0 0 0 10.86-4.43V7.83a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.16-.26z" />
	</svg>
);

const socialLinks = [
	{
		name: "Website",
		url: ooocWebsiteUrl,
		icon: Globe,
		ariaLabel: "Visit Out of Office Collective website",
	},
	{
		name: "Instagram",
		url: ooocInstagramUrl,
		icon: InstagramIcon,
		ariaLabel: "Follow Out of Office Collective on Instagram",
	},
	{
		name: "TikTok",
		url: ooocTikTokUrl,
		icon: TikTokIcon,
		ariaLabel: "Follow Out of Office Collective on TikTok",
	},
] as const;

const Footer = () => {
	return (
		<footer className="relative overflow-hidden border-t border-border/35 bg-card/36 pb-[calc(var(--oooc-mobile-nav-clearance,5.75rem)+env(safe-area-inset-bottom))] backdrop-blur-[2px] lg:pb-0 dark:border-[#f0b668]/18 dark:bg-transparent">
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f0b668]/22 to-transparent dark:via-[#f0b668]/20"
				aria-hidden="true"
			/>
			<div
				className="pointer-events-none absolute inset-0 bg-[image:var(--ooo-grain-image)] bg-[length:220px_220px] opacity-[0.1] mix-blend-multiply dark:opacity-[0.2] dark:mix-blend-soft-light"
				aria-hidden="true"
			/>
			<div
				className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#f0b668]/[0.03] via-[#f0b668]/[0.012] to-transparent dark:from-[#f0b668]/[0.09] dark:via-[#2f2419]/35"
				aria-hidden="true"
			/>
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/28 to-transparent dark:from-[#1b130d]/30"
				aria-hidden="true"
			/>
			<div className="container relative mx-auto px-4 py-7 sm:py-6">
				<div className="flex flex-col items-center justify-center gap-6 lg:flex-row lg:justify-between">
					{/* Social Links */}
					<div className="flex w-full flex-col items-center gap-4 lg:w-auto lg:items-start">
						<div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
							<span className="text-center text-sm text-muted-foreground sm:text-left">
								Follow us on socials for updates
							</span>
							<div className="flex items-center justify-center gap-2">
								{socialLinks.map((social) => {
									const IconComponent = social.icon;
									return (
										<Link
											key={social.name}
											href={social.url}
											target="_blank"
											rel="noopener noreferrer"
											aria-label={social.ariaLabel}
											className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										>
											<IconComponent className="h-4 w-4" />
											<ExternalLink className="ml-1 h-3 w-3" />
										</Link>
									);
								})}
							</div>
						</div>
						<nav
							aria-label="Footer"
							className="grid w-full max-w-sm grid-cols-2 gap-x-5 gap-y-2 text-center text-xs sm:max-w-none sm:grid-cols-none sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4 sm:gap-y-2 lg:justify-start"
						>
							<Link
								href="/how-it-works"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								How it works
							</Link>
							<Link
								href="/submit-event"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Submit your event
							</Link>
							<Link
								href="/exchange"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Ticket Exchange
							</Link>
							<Link
								href="/feature-event"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Promote
							</Link>
							<Link
								href="/privacy"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Privacy Policy
							</Link>
							<Link
								href="/terms"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Terms
							</Link>
							<Link
								href={ooocContactUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								Contact us
							</Link>
							<Link
								href={ooocFaqUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
							>
								FAQ&apos;s
							</Link>
						</nav>
					</div>

					{/* Version and Attribution */}
					<div className="flex flex-col items-center space-y-1 text-center lg:items-end lg:text-right">
						<div className="flex flex-col items-center space-y-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:space-x-1 sm:space-y-0">
							<div className="flex flex-wrap items-center justify-center gap-x-1 lg:justify-end">
								<span>Web app v2.0.0 • Made by</span>
								<Link
									href={creatorXUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
									title="Follow Milkandhenny on X (Twitter)"
								>
									Milkandhenny
								</Link>
							</div>
							<span className="hidden sm:inline">•</span>
							<Link
								href={supportCoffeeUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center space-x-1 font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
								title="Buy me a croissant if this was helpful"
							>
								<Croissant className="h-3 w-3" />
								<span>Buy me a croissant</span>
							</Link>
						</div>
						<Tooltip>
							<TooltipTrigger
								id="footer-community-tooltip-trigger"
								render={<span className="text-xs text-muted-foreground/70" />}
							>
								Maintained by the OOOC Community
							</TooltipTrigger>
							<TooltipContent id="footer-community-tooltip-content">
								<p>With special thanks to Mel</p>
							</TooltipContent>
						</Tooltip>
						<p className="max-w-md text-xs leading-relaxed text-muted-foreground/55">
							&copy; 2026 {legalEntityName}. All rights reserved. OOOC and Fête
							Finder are trade marks. Full legal details are in our{" "}
							<Link
								href="/terms"
								className="underline underline-offset-4 transition-colors hover:text-foreground"
							>
								Terms
							</Link>
							.
						</p>
					</div>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
