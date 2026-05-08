import { Button } from "@/components/ui/button";
import { Filter, Lock, Mail } from "lucide-react";
import React, { useEffect, useState } from "react";

type AuthGateProps = {
	isAuthenticated: boolean;
	isAuthResolved: boolean;
	onAuthRequired: () => void;
	children: React.ReactNode;
	className?: string;
	variant?: "default" | "filter-preview";
};

const AuthGate = ({
	isAuthenticated,
	isAuthResolved,
	onAuthRequired,
	children,
	className = "",
	variant = "default",
}: AuthGateProps) => {
	const [hasMounted, setHasMounted] = useState(false);
	const [showOverlay, setShowOverlay] = useState(false);

	useEffect(() => {
		if (isAuthenticated || !isAuthResolved) {
			setHasMounted(false);
			setShowOverlay(false);
			return;
		}

		// Small delay to prevent flash on initial load
		const mountTimer = setTimeout(() => {
			setHasMounted(true);
			// Additional delay for smooth fade-in
			const overlayTimer = setTimeout(() => {
				setShowOverlay(true);
			}, 50);
			return () => clearTimeout(overlayTimer);
		}, 100);

		return () => clearTimeout(mountTimer);
	}, [isAuthenticated, isAuthResolved]);

	// Keep content visible until auth is resolved and overlay timing is ready.
	if (!isAuthResolved || isAuthenticated || !hasMounted) {
		return <>{children}</>;
	}

	if (variant === "filter-preview") {
		return (
			<div className={`relative hidden lg:block ${className}`}>
				<div className="pointer-events-none select-none opacity-45 blur-[1px] saturate-[0.9]">
					{children}
				</div>
				<div
					className={`absolute inset-0 z-30 rounded-xl border border-border/55 bg-background/38 p-3 backdrop-blur-[2px] transition-all duration-500 ease-out ${
						showOverlay ? "opacity-100" : "opacity-0"
					}`}
				>
					<div
						className={`ooo-site-card-soft rounded-xl border border-border/75 bg-card/92 p-3 shadow-sm transition-all delay-100 duration-500 ease-out ${
							showOverlay
								? "translate-y-0 opacity-100"
								: "translate-y-2 opacity-0"
						}`}
					>
						<div className="flex items-start gap-3">
							<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70">
								<Filter className="h-4 w-4 text-foreground/82" />
							</div>
							<div className="min-w-0 flex-1">
								<h3 className="text-sm font-medium text-foreground">
									Unlock filters
								</h3>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									Narrow by day, price, area, genre and curated picks.
								</p>
							</div>
						</div>
						<Button
							onClick={onAuthRequired}
							className="mt-3 h-9 w-full gap-2 rounded-full shadow-sm"
							size="sm"
						>
							<Mail className="h-3.5 w-3.5" />
							Continue with email
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={`relative ${className}`}>
			{children}
			<div
				className={`absolute inset-0 z-30 flex items-center justify-center rounded-xl border border-border/50 bg-gradient-to-br from-background/95 via-background/90 to-background/95 shadow-lg backdrop-blur-md transition-all duration-500 ease-out ${
					showOverlay ? "scale-100 opacity-100" : "scale-95 opacity-0"
				}`}
			>
				<div
					className={`mx-auto max-w-sm space-y-4 p-6 text-center transition-all delay-200 duration-700 ease-out ${
						showOverlay
							? "translate-y-0 opacity-100"
							: "translate-y-4 opacity-0"
					}`}
				>
					<div className="flex justify-center">
						<div className="rounded-full border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-3 shadow-md">
							<Lock className="h-5 w-5 text-primary" />
						</div>
					</div>
					<div className="space-y-2">
						<h3 className="text-base font-semibold text-foreground">
							Authentication Required
						</h3>
						<p className="text-sm leading-relaxed text-muted-foreground">
							Provide your email to access filtering and search
						</p>
					</div>
					<Button
						onClick={onAuthRequired}
						className="h-10 w-full gap-2 shadow-md transition-all duration-200 hover:shadow-lg"
						size="default"
					>
						<Mail className="h-4 w-4" />
						Continue with Email
					</Button>
				</div>
			</div>
		</div>
	);
};

export default AuthGate;
