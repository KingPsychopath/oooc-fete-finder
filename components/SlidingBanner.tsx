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

	const animationDurationSeconds =
		typeof speed === "number" && Number.isFinite(speed) && speed > 0
			? speed
			: Math.max(18, Math.min(120, (messageDurationMs / 1000) * 6.5));
	const marqueeMessages =
		desktopMessageCount === 2
			? [...normalizedMessages, ...normalizedMessages]
			: normalizedMessages;

	const renderMessageRow = (copyKey: string) => (
		<div className="flex shrink-0 items-center gap-10 px-5 sm:gap-14 sm:px-7 md:gap-20 lg:gap-24">
			{marqueeMessages.map((message, index) => (
				<div
					key={`${copyKey}-${message}-${index}`}
					className="flex shrink-0 items-center gap-10 sm:gap-14 md:gap-20 lg:gap-24"
				>
					<span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/78 sm:text-xs sm:tracking-[0.22em]">
						{message}
					</span>
					<span
						className="h-px w-8 bg-foreground/24 sm:w-12 dark:bg-foreground/28"
						aria-hidden="true"
					/>
				</div>
			))}
		</div>
	);

	return (
		<div
			aria-label={normalizedMessages.join(". ")}
			className={cn(
				"relative overflow-hidden border-b border-white/20 bg-gradient-to-r from-white/10 via-white/5 to-white/10 shadow-sm backdrop-blur-sm [mask-image:linear-gradient(90deg,transparent,black_9%,black_91%,transparent)] dark:border-white/10 dark:from-white/5 dark:via-white/2 dark:to-white/5",
				className,
			)}
		>
			<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
			<div
				className="relative flex w-max animate-slide-banner py-2"
				style={{ animationDuration: `${animationDurationSeconds}s` }}
				aria-hidden="true"
			>
				{renderMessageRow("primary")}
				{renderMessageRow("secondary")}
			</div>
		</div>
	);
};

export default SlidingBanner;
