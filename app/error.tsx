"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Note: Using process.env.NODE_ENV directly to avoid server-side env variable access on client
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

type ErrorPageProps = {
	error: Error & { digest?: string };
	reset: () => void;
};

export default function Error({ error, reset }: ErrorPageProps) {
	const router = useRouter();

	React.useEffect(() => {
		// Log the error to your error reporting service
		console.error("🚨 Next.js Error Boundary caught an error:", error);

		// You could send to an error reporting service here
		// Example: errorReportingService.captureException(error)
	}, [error]);

	const goHome = () => {
		router.push("/");
	};

	const reloadPage = () => {
		window.location.reload();
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
						<AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
					</div>
					<CardTitle className="text-2xl font-semibold">
						Oops! Something went wrong
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6 text-center">
					<p className="text-muted-foreground">
						We encountered an unexpected error while loading the page. This has
						been logged and we'll look into it.
					</p>

					{/* Development error details */}
					{process.env.NODE_ENV === "development" && (
						<details className="text-left bg-muted p-4 rounded-lg">
							<summary className="cursor-pointer text-sm font-medium mb-2 text-red-600">
								🐛 Error Details (Development Only)
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
											Digest:
										</span>
										<pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
											{error.digest}
										</pre>
									</div>
								)}
								{error.stack && (
									<div>
										<span className="text-xs font-medium text-muted-foreground">
											Stack:
										</span>
										<pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto max-h-32">
											{error.stack}
										</pre>
									</div>
								)}
							</div>
						</details>
					)}

					{/* Action buttons */}
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Button
							onClick={reset}
							className="flex items-center gap-2"
							size="lg"
						>
							<RefreshCw className="h-4 w-4" />
							Try Again
						</Button>
						<Button
							onClick={goHome}
							variant="outline"
							size="lg"
							className="flex items-center gap-2"
						>
							<Home className="h-4 w-4" />
							Go Home
						</Button>
						<Button
							onClick={reloadPage}
							variant="outline"
							size="lg"
							className="flex items-center gap-2"
						>
							<RefreshCw className="h-4 w-4" />
							Reload Page
						</Button>
					</div>

					<div className="text-xs text-muted-foreground">
						If this problem persists, please contact support or try refreshing
						the page.
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
