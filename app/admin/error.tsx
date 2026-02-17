"use client";

import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

type AdminErrorPageProps = {
	error: Error & { digest?: string };
	reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorPageProps) {
	const router = useRouter();

	React.useEffect(() => {
		console.error("🚨 Admin Panel Error:", error);
	}, [error]);

	const goHome = () => {
		router.push("/");
	};

	const goToAdminLogin = () => {
		// Clear any admin state and redirect to admin login
		router.push("/admin");
	};

	// Check if this is an authentication error
	const isAuthError =
		error.message.toLowerCase().includes("unauthorized") ||
		error.message.toLowerCase().includes("admin") ||
		error.message.toLowerCase().includes("auth");

	return (
		<RouteState
			icon={
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
					{isAuthError ? (
						<Shield className="h-8 w-8 text-destructive" />
					) : (
						<AlertTriangle className="h-8 w-8 text-destructive" />
					)}
				</div>
			}
			title={isAuthError ? "Admin Access Required" : "Admin Panel Error"}
			description={
				isAuthError
					? "You need a valid admin session to continue."
					: "Something failed while loading the admin console."
			}
			actions={
				<div className="flex flex-col justify-center gap-3 sm:flex-row">
					{isAuthError ? (
						<Button
							onClick={goToAdminLogin}
							className="flex items-center gap-2"
							size="lg"
						>
							<Shield className="h-4 w-4" />
							Admin Login
						</Button>
					) : (
						<Button onClick={reset} className="flex items-center gap-2" size="lg">
							<RefreshCw className="h-4 w-4" />
							Retry
						</Button>
					)}
					<Button
						onClick={goHome}
						variant="outline"
						size="lg"
						className="flex items-center gap-2"
					>
						<Home className="h-4 w-4" />
						Back to Home
					</Button>
				</div>
			}
			footer={
				process.env.NODE_ENV === "development" ? (
					<details className="rounded-lg bg-muted p-3 text-left">
						<summary className="cursor-pointer text-xs font-medium text-destructive">
							Error details (dev)
						</summary>
						<pre className="mt-2 max-h-36 overflow-auto text-[11px]">
							{error.stack || error.message}
						</pre>
					</details>
				) : (
					"Verify admin session and environment configuration if this persists."
				)
			}
		/>
	);
}
