"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isDev } from "@/lib/config/env";

type ErrorBoundaryState = {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
};

type ErrorBoundaryProps = {
	children: React.ReactNode;
	fallback?: React.ComponentType<{
		error: Error | null;
		resetError: () => void;
	}>;
};

class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("🚨 Error Boundary caught an error:", error);
		console.error("📋 Error Info:", errorInfo);

		this.setState({
			error,
			errorInfo,
		});
	}

	resetError = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				const FallbackComponent = this.props.fallback;
				return (
					<FallbackComponent
						error={this.state.error}
						resetError={this.resetError}
					/>
				);
			}

			return (
				<DefaultErrorFallback
					error={this.state.error}
					resetError={this.resetError}
				/>
			);
		}

		return this.props.children;
	}
}

const DefaultErrorFallback = ({
	error,
	resetError,
}: {
	error: Error | null;
	resetError: () => void;
}) => {
	const reloadPage = () => {
		window.location.reload();
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
						<AlertTriangle className="h-6 w-6 text-red-600" />
					</div>
					<CardTitle className="text-xl font-semibold">
						Something went wrong
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-center">
					<p className="text-muted-foreground">
						We encountered an unexpected error. This has been logged and we'll
						look into it.
					</p>

					{isDev && error && (
						<details className="text-left">
							<summary className="cursor-pointer text-sm font-medium mb-2">
								Error Details (Development)
							</summary>
							<pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
								{error.message}
							</pre>
						</details>
					)}

					<div className="flex gap-2 justify-center">
						<Button
							onClick={resetError}
							variant="outline"
							size="sm"
							className="flex items-center gap-2"
						>
							<RefreshCw className="h-4 w-4" />
							Try Again
						</Button>
						<Button
							onClick={reloadPage}
							size="sm"
							className="flex items-center gap-2"
						>
							<RefreshCw className="h-4 w-4" />
							Reload Page
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export { ErrorBoundary };
export type { ErrorBoundaryProps };
