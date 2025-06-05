import React from "react";

type SlidingBannerProps = {
	messages: string[];
	speed?: number; // seconds for one complete cycle
	className?: string;
};

const SlidingBanner: React.FC<SlidingBannerProps> = ({
	messages,
	speed = 20,
	className = "",
}) => {
	// Join messages with separators (no duplication)
	const bannerContent = messages.join(" • ");

	return (
		<div
			className={`relative overflow-hidden backdrop-blur-sm bg-gradient-to-r from-white/10 via-white/5 to-white/10 dark:from-white/5 dark:via-white/2 dark:to-white/5 border-b border-white/20 dark:border-white/10 shadow-sm ${className}`}
		>
			{/* Glass overlay for extra depth */}
			<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
			
			{/* Animated content */}
			<div
				className="relative whitespace-nowrap animate-slide-banner py-1.5 px-4 text-xs font-medium text-foreground/80 tracking-wide"
				style={{
					animationDuration: `${speed}s`,
				}}
			>
				{bannerContent}
			</div>
		</div>
	);
};

export default SlidingBanner; 