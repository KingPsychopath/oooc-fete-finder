import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Coffee, ExternalLink, Globe } from "lucide-react";
import Link from "next/link";

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
		url: "https://www.outofofficecollective.co.uk/",
		icon: Globe,
		ariaLabel: "Visit Out of Office Collective website",
	},
	{
		name: "Instagram",
		url: "https://www.instagram.com/outofofficecollectivee/",
		icon: InstagramIcon,
		ariaLabel: "Follow Out of Office Collective on Instagram",
	},
	{
		name: "TikTok",
		url: "https://www.tiktok.com/@outofofficecollective",
		icon: TikTokIcon,
		ariaLabel: "Follow Out of Office Collective on TikTok",
	},
] as const;

const Footer = () => {
	return (
		<footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container mx-auto px-4 py-6">
				<div className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:justify-between sm:space-y-0">
					{/* Social Links */}
					<div className="flex items-center space-x-4">
						<span className="text-sm text-muted-foreground">Follow us:</span>
						{socialLinks.map((social) => {
							const IconComponent = social.icon;
							return (
								<Link
									key={social.name}
									href={social.url}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={social.ariaLabel}
									className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
								>
									<IconComponent className="h-4 w-4" />
									<ExternalLink className="ml-1 h-3 w-3" />
								</Link>
							);
						})}
					</div>

					{/* Version and Attribution */}
					<div className="flex flex-col items-center sm:items-end space-y-1">
						<div className="flex flex-col items-center sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-1 text-xs text-muted-foreground">
							<div className="flex items-center space-x-1">
								<span>Web app v1.0.0 • Made by</span>
								<Link
									href="https://x.com/milkandh3nny"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
									title="Follow Milkandhenny on X (Twitter)"
								>
									Milkandhenny
								</Link>
							</div>
							<span className="hidden sm:inline">•</span>
							<Link
								href="https://coff.ee/milkandhenny"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center space-x-1 font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm"
								title="Buy me a drink if this was helpful"
							>
								<Coffee className="h-3 w-3" />
								<span>Buy me a coffee</span>
							</Link>
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="text-xs text-muted-foreground/70 cursor-help">
									Maintained by the OOOC Community
								</span>
							</TooltipTrigger>
							<TooltipContent>
								<p>With special thanks to Mel</p>
							</TooltipContent>
						</Tooltip>
					</div>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
