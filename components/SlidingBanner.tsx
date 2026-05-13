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
					<span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/58 sm:text-xs sm:tracking-[0.22em] dark:text-foreground/66">
						{message}
					</span>
					<span
						className="h-px w-8 bg-foreground/14 sm:w-12 dark:bg-foreground/16"
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
				"relative overflow-hidden bg-transparent shadow-none [mask-image:linear-gradient(90deg,transparent,black_11%,black_89%,transparent)]",
				className,
			)}
		>
			<div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/12 to-transparent dark:via-background/10" />
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
