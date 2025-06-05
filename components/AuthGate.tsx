import React from "react";
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
	if (isAuthenticated) {
		return <>{children}</>;
	}

	return (
		<div className={`relative ${className}`}>
			{children}
			{/* Beautiful auth overlay */}
			<div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/95 backdrop-blur-md rounded-xl border border-border/50 shadow-lg flex items-center justify-center z-30">
				<div className="text-center space-y-4 p-6 max-w-sm mx-auto">
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
