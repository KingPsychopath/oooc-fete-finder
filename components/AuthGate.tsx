import React, { useEffect, useState } from "react";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

type AuthGateProps = {
	isAuthenticated: boolean;
	onAuthRequired: () => void;
	children: React.ReactNode;
	className?: string;
};

const AuthGate = ({
	isAuthenticated,
	onAuthRequired,
	children,
	className = "",
}: AuthGateProps) => {
	const [hasMounted, setHasMounted] = useState(false);
	const [showOverlay, setShowOverlay] = useState(false);

	useEffect(() => {
		// Small delay to prevent flash on initial load
		const timer = setTimeout(() => {
			setHasMounted(true);
			// Additional delay for smooth fade-in
			if (!isAuthenticated) {
				setTimeout(() => {
					setShowOverlay(true);
				}, 50);
			}
		}, 100);

		return () => clearTimeout(timer);
	}, [isAuthenticated]);

	// Show children immediately if authenticated or if we haven't mounted yet
	if (isAuthenticated || !hasMounted) {
		return <>{children}</>;
	}

	return (
		<div className={`relative ${className}`}>
			{children}
			{/* Beautiful auth overlay with fade-in animation */}
			<div 
				className={`absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/95 backdrop-blur-md rounded-xl border border-border/50 shadow-lg flex items-center justify-center z-30 transition-all duration-500 ease-out ${
					showOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
				}`}
			>
				<div className={`text-center space-y-4 p-6 max-w-sm mx-auto transition-all duration-700 ease-out delay-200 ${
					showOverlay ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
				}`}>
					<div className="flex justify-center">
						<div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full border border-primary/20 shadow-md">
							<Lock className="h-5 w-5 text-primary" />
						</div>
					</div>
					<div className="space-y-2">
						<h3 className="font-semibold text-base text-foreground">
							Authentication Required
						</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Provide your email to access filtering and search
						</p>
					</div>
					<Button
						onClick={onAuthRequired}
						className="gap-2 w-full shadow-md hover:shadow-lg transition-all duration-200"
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
