"use client";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle, Cloud, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

interface IntegrationStatus {
	gcp: {
		configured: boolean;
		purpose: string;
		status: string;
	};
	geocoding: {
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
					Geocoding (map) and admin sheet import/preview only
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-2">
					{status.overall.includes("✅") ? (
						<CheckCircle className="h-4 w-4 text-green-600" />
					) : (
						<AlertCircle className="h-4 w-4 text-yellow-600" />
					)}
					<span className="font-medium">{status.overall}</span>
				</div>

				<div className="flex items-start gap-3 p-3 border rounded-lg">
					<div className="flex-shrink-0">
						<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
							<Cloud className="h-4 w-4 text-blue-600" />
						</div>
					</div>
					<div className="flex-grow">
						<div className="flex items-center gap-2 mb-1">
							<h3 className="font-semibold text-sm">GCP Service Account</h3>
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

				<div className="flex items-start gap-3 p-3 border rounded-lg">
					<div className="flex-shrink-0">
						<div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
							<MapPin className="h-4 w-4 text-green-600" />
						</div>
					</div>
					<div className="flex-grow">
						<div className="flex items-center gap-2 mb-1">
							<h3 className="font-semibold text-sm">Geocoding (Maps API)</h3>
							<Badge
								variant={
									status.geocoding.configured ? "default" : "destructive"
								}
								className="text-xs"
							>
								{status.geocoding.configured ? "Configured" : "Missing"}
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground mb-1">
							{status.geocoding.purpose}
						</p>
						<p className="text-xs font-mono">{status.geocoding.status}</p>
					</div>
				</div>

				<div className="mt-4 p-3 bg-muted rounded-lg">
					<h4 className="font-semibold text-sm mb-2">📚 Google usage (only these):</h4>
					<ul className="text-xs space-y-1 text-muted-foreground">
						<li>
							<span className="font-mono text-green-600">Geocoding</span> — Map
							coordinates (GOOGLE_MAPS_API_KEY)
						</li>
						<li>
							<span className="font-mono text-blue-600">Admin</span> — Import /
							Preview from your event Sheet (GOOGLE_SHEET_ID or REMOTE_CSV_URL)
						</li>
					</ul>
				</div>
			</CardContent>
		</Card>
	);
};
