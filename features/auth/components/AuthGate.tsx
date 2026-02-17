import { Button } from "@/components/ui/button";
import { Lock, Mail } from "lucide-react";
import React from "react";

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
	if (!isAuthResolved) {
		return (
			<div className={`relative ${className}`}>
				{children}
				<div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl border border-border/70 bg-card/88 shadow-lg backdrop-blur-md">
					<div className="mx-auto max-w-xs p-4 text-center md:max-w-md md:p-8">
						<p className="text-xs font-medium tracking-[0.08em] text-muted-foreground md:text-sm">
							Checking session...
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (isAuthenticated) {
		return <>{children}</>;
	}

	return (
		<div className={`relative ${className}`}>
			{children}
			<div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl border border-border/70 bg-card/92 shadow-lg backdrop-blur-md">
				<div className="mx-auto max-w-xs space-y-4 p-4 text-center md:max-w-md md:p-8">
					<div className="flex justify-center">
						<div className="rounded-full border border-border/70 bg-background/72 p-3 shadow-sm">
							<Lock className="h-5 w-5 text-primary" />
						</div>
					</div>
					<div className="space-y-2">
						<h3 className="text-sm font-semibold text-foreground md:text-base">
							Authentication Required
						</h3>
						<p className="text-xs leading-relaxed text-muted-foreground md:text-sm">
							Provide your name and email to access filtering and search
						</p>
					</div>
					<Button
						onClick={onAuthRequired}
						className="h-10 w-full gap-2 text-sm shadow-md transition-all duration-200 hover:shadow-lg md:text-base"
						size="sm"
					>
						<Mail className="h-4 w-4" />
						Continue with Details
					</Button>
				</div>
			</div>
		</div>
	);
};

export default AuthGate;
