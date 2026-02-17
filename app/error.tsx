"use client";

import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
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
		<RouteState
			icon={
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle className="h-8 w-8 text-destructive" />
				</div>
			}
			title="Something Went Wrong"
			description="We hit an unexpected issue while loading this page."
			actions={
				<div className="flex flex-col justify-center gap-3 sm:flex-row">
					<Button onClick={reset} className="flex items-center gap-2" size="lg">
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
						Reload
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
					"If this keeps happening, please try again shortly."
				)
			}
		/>
	);
}
