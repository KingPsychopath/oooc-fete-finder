import { cn } from "@/lib/utils";

type SlidingBannerProps = {
	messages: string[];
	speed?: number;
	messageDurationMs?: number;
	desktopMessageCount?: 1 | 2;
	className?: string;
};

const SlidingBanner = ({
	messages,
	speed,
	messageDurationMs = 4200,
	desktopMessageCount = 2,
	className,
}: SlidingBannerProps) => {
	const normalizedMessages = messages
		.map((message) => message.replace(/\s+/g, " ").trim())
		.filter((message) => message.length > 0);

	if (normalizedMessages.length === 0) {
		return null;
	}

	const bannerContent = normalizedMessages.join(" • ");
	const animationDurationSeconds =
		typeof speed === "number" && Number.isFinite(speed) && speed > 0
			? speed
			: Math.max(8, Math.min(120, (messageDurationMs / 1000) * 4.75));
	const secondaryContent = desktopMessageCount === 2 ? ` • ${bannerContent}` : "";

	return (
		<div
			className={cn(
				"relative overflow-hidden border-b border-white/20 bg-gradient-to-r from-white/10 via-white/5 to-white/10 shadow-sm backdrop-blur-sm dark:border-white/10 dark:from-white/5 dark:via-white/2 dark:to-white/5",
				className,
			)}
		>
			<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
			<div
				className="relative animate-slide-banner whitespace-nowrap px-4 py-1.5 text-xs font-medium tracking-wide text-foreground/80"
				style={{ animationDuration: `${animationDurationSeconds}s` }}
			>
				{bannerContent}
				<span className="hidden md:inline">{secondaryContent}</span>
			</div>
		</div>
	);
};

export default SlidingBanner;
