import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Mail } from "lucide-react";

type AuthGateProps = {
	isAuthenticated: boolean;
	isAuthResolved: boolean;
	onAuthRequired: () => void;
	children: React.ReactNode;
	className?: string;
};

const AuthGate = ({
	isAuthenticated,
	isAuthResolved,
	onAuthRequired,
	children,
	className = "",
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
						showOverlay ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
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
