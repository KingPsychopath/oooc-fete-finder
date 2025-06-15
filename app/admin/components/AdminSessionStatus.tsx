import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogOut, RefreshCw, User } from "lucide-react";
import {
	getSessionInfo,
	getSessionToken,
	clearAdminSession,
} from "@/lib/admin/admin-session";
import { extendAdminSession } from "@/lib/admin/actions";

interface AdminSessionStatusProps {
	onLogout: () => void;
}

export const AdminSessionStatus: React.FC<AdminSessionStatusProps> = ({
	onLogout,
}) => {
	const [sessionInfo, setSessionInfo] = useState(getSessionInfo());
	const [isExtending, setIsExtending] = useState(false);

	// Update session info every minute
	useEffect(() => {
		const interval = setInterval(() => {
			setSessionInfo(getSessionInfo());
		}, 60000); // Update every minute

		return () => clearInterval(interval);
	}, []);

	// Handle session extension
	const handleExtendSession = async () => {
		setIsExtending(true);
		try {
			const sessionToken = getSessionToken();
			if (sessionToken) {
				const result = await extendAdminSession(sessionToken);
				if (result.success) {
					setSessionInfo(getSessionInfo());
				}
			}
		} finally {
			setIsExtending(false);
		}
	};

	// Handle logout
	const handleLogout = () => {
		clearAdminSession();
		onLogout();
	};

	if (!sessionInfo.isValid) {
		return null; // Don't show if no valid session
	}

	// Determine session status
	const getSessionStatus = () => {
		if (!sessionInfo.expiresIn)
			return { variant: "destructive" as const, text: "Expired" };

		const expiresInMs = sessionInfo.expiresAt!.getTime() - Date.now();
		const hoursUntilExpiry = expiresInMs / (1000 * 60 * 60);

		if (hoursUntilExpiry < 1) {
			return { variant: "destructive" as const, text: "Expiring Soon" };
		}
		if (hoursUntilExpiry < 4) {
			return { variant: "secondary" as const, text: "Active" };
		}
		return { variant: "default" as const, text: "Active" };
	};

	const status = getSessionStatus();

	return (
		<Card className="mb-4">
			<CardHeader className="pb-3">
				<CardTitle className="text-lg flex items-center gap-2">
					<User className="h-5 w-5" />
					Admin Session
					<Badge variant={status.variant}>{status.text}</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Expires in:</span>
						<span className="font-medium">
							{sessionInfo.expiresIn || "Expired"}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Created:</span>
						<span className="font-medium">
							{sessionInfo.sessionAge || "Unknown"}
						</span>
					</div>
				</div>

				{sessionInfo.expiresAt && (
					<div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
						<strong>Session expires:</strong>{" "}
						{sessionInfo.expiresAt.toLocaleString()}
					</div>
				)}

				<div className="flex gap-2">
					<Button
						onClick={handleExtendSession}
						disabled={isExtending}
						variant="outline"
						size="sm"
						className="flex items-center gap-2"
					>
						<RefreshCw
							className={`h-4 w-4 ${isExtending ? "animate-spin" : ""}`}
						/>
						{isExtending ? "Extending..." : "Extend Session"}
					</Button>

					<Button
						onClick={handleLogout}
						variant="outline"
						size="sm"
						className="flex items-center gap-2 text-red-600 hover:text-red-700"
					>
						<LogOut className="h-4 w-4" />
						Logout
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
