"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, RefreshCw, Home, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { isDev } from "@/lib/config/env";

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
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
						{isAuthError ? (
							<Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
						) : (
							<AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
						)}
					</div>
					<CardTitle className="text-2xl font-semibold">
						{isAuthError ? "Admin Access Required" : "Admin Panel Error"}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6 text-center">
					<p className="text-muted-foreground">
						{isAuthError
							? "You need admin privileges to access this page. Please authenticate with your admin key."
							: "We encountered an error in the admin panel. This has been logged and we'll look into it."}
					</p>

									{/* Development error details */}
				{isDev && (
						<details className="text-left bg-muted p-4 rounded-lg">
							<summary className="cursor-pointer text-sm font-medium mb-2 text-red-600">
								🔧 Admin Error Details (Development)
							</summary>
							<div className="space-y-2">
								<div>
									<span className="text-xs font-medium text-muted-foreground">
										Message:
									</span>
									<pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
										{error.message}
									</pre>
								</div>
								{error.digest && (
									<div>
										<span className="text-xs font-medium text-muted-foreground">
											Error ID:
										</span>
										<pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
											{error.digest}
										</pre>
									</div>
								)}
								<div className="text-xs text-muted-foreground mt-2">
									💡 Common admin issues:
									<ul className="list-disc list-inside mt-1 space-y-1">
										<li>Invalid or expired admin key</li>
										<li>Google Sheets API configuration issues</li>
										<li>Network connectivity problems</li>
										<li>Server-side authentication failures</li>
									</ul>
								</div>
							</div>
						</details>
					)}

					{/* Action buttons */}
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
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
							<Button
								onClick={reset}
								className="flex items-center gap-2"
								size="lg"
							>
								<RefreshCw className="h-4 w-4" />
								Retry Admin Panel
							</Button>
						)}

						<Button
							onClick={goHome}
							variant="outline"
							size="lg"
							className="flex items-center gap-2"
						>
							<Home className="h-4 w-4" />
							Back to Events
						</Button>
					</div>

					<div className="text-xs text-muted-foreground">
						Admin key: Use environment variable ADMIN_KEY or default
						"your-secret-key-123"
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
