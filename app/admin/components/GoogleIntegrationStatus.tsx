"use client";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle, Cloud, Code } from "lucide-react";
import { useEffect, useState } from "react";

interface IntegrationStatus {
	gcp: {
		configured: boolean;
		purpose: string;
		status: string;
	};
	appsScript: {
		configured: boolean;
		purpose: string;
		status: string;
	};
	overall: string;
}

export const GoogleIntegrationStatus = () => {
	const [status, setStatus] = useState<IntegrationStatus | null>(null);

	useEffect(() => {
		const checkStatus = async () => {
			try {
				const { validateGoogleIntegrations } = await import(
					"@/lib/google/integration-status"
				);
				const integrationStatus = validateGoogleIntegrations();
				setStatus(integrationStatus);
			} catch (error) {
				console.error("Failed to check Google integration status:", error);
			}
		};

		checkStatus();
	}, []);

	if (!status) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Cloud className="h-5 w-5" />
						Google Integrations
					</CardTitle>
					<CardDescription>Checking integration status...</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Cloud className="h-5 w-5" />
					Google Integrations
				</CardTitle>
				<CardDescription>
					Current status of your Google Cloud and Apps Script integrations
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Overall Status */}
				<div className="flex items-center gap-2">
					{status.overall.includes("✅") ? (
						<CheckCircle className="h-4 w-4 text-green-600" />
					) : (
						<AlertCircle className="h-4 w-4 text-yellow-600" />
					)}
					<span className="font-medium">{status.overall}</span>
				</div>

				{/* GCP Service Account API */}
				<div className="flex items-start gap-3 p-3 border rounded-lg">
					<div className="flex-shrink-0">
						<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
							<Cloud className="h-4 w-4 text-blue-600" />
						</div>
					</div>
					<div className="flex-grow">
						<div className="flex items-center gap-2 mb-1">
							<h3 className="font-semibold text-sm">GCP Service Account API</h3>
							<Badge
								variant={status.gcp.configured ? "default" : "destructive"}
								className="text-xs"
							>
								{status.gcp.configured ? "Configured" : "Missing"}
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground mb-1">
							{status.gcp.purpose}
						</p>
						<p className="text-xs font-mono">{status.gcp.status}</p>
					</div>
				</div>

				{/* Google Apps Script */}
				<div className="flex items-start gap-3 p-3 border rounded-lg">
					<div className="flex-shrink-0">
						<div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
							<Code className="h-4 w-4 text-orange-600" />
						</div>
					</div>
					<div className="flex-grow">
						<div className="flex items-center gap-2 mb-1">
							<h3 className="font-semibold text-sm">Google Apps Script</h3>
							<Badge
								variant={
									status.appsScript.configured ? "default" : "destructive"
								}
								className="text-xs"
							>
								{status.appsScript.configured ? "Configured" : "Missing"}
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground mb-1">
							{status.appsScript.purpose}
						</p>
						<p className="text-xs font-mono">{status.appsScript.status}</p>
					</div>
				</div>

				{/* Integration Guide */}
				<div className="mt-4 p-3 bg-muted rounded-lg">
					<h4 className="font-semibold text-sm mb-2">📚 Quick Reference:</h4>
					<ul className="text-xs space-y-1 text-muted-foreground">
						<li>
							<span className="font-mono text-blue-600">GCP API:</span> Reading
							event data (high performance)
						</li>
						<li>
							<span className="font-mono text-orange-600">Apps Script:</span>{" "}
							Writing user data & admin functions
						</li>
					</ul>
				</div>
			</CardContent>
		</Card>
	);
};
