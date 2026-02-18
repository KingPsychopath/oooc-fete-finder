import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	getAdminSessionOverview,
	getAdminSessionStatus,
	getAdminTokenSessions,
	revokeAdminTokenSessionByJti,
	revokeAllAdminTokenSessionsAction,
} from "@/features/auth/actions";
import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SessionInfo = {
	isValid: boolean;
	expiresAt?: number;
	expiresIn?: string;
	sessionAge?: string;
	jti?: string;
};

type TokenSession = {
	jti: string;
	tv: number;
	iat: number;
	exp: number;
	ip: string;
	ua: string;
	status: "active" | "expired" | "revoked" | "invalidated";
};

type AdminSessionStatusProps = {
	initialSessionStatus?: Awaited<
		ReturnType<typeof getAdminSessionStatus>
	>;
	initialTokenSessions?: Awaited<
		ReturnType<typeof getAdminTokenSessions>
	>;
	onLogout: () => void | Promise<void>;
};

function sessionInfoFromStatus(
	status: AdminSessionStatusProps["initialSessionStatus"],
): SessionInfo {
	if (!status?.success) return { isValid: false };
	return {
		isValid: status.isValid,
		expiresAt: status.expiresAt,
		expiresIn: status.expiresIn,
		sessionAge: status.sessionAge,
		jti: status.jti,
	};
}

const getSessionBadge = (expiresAt: number | undefined) => {
	if (!expiresAt) {
		return { variant: "destructive" as const, label: "Expired" };
	}

	const hoursUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60);
	if (hoursUntilExpiry < 1) {
		return { variant: "destructive" as const, label: "Expiring soon" };
	}
	if (hoursUntilExpiry < 4) {
		return { variant: "secondary" as const, label: "Short window" };
	}

	return { variant: "default" as const, label: "Active" };
};

const shortJti = (jti: string) => {
	if (jti.length <= 16) return jti;
	return `${jti.slice(0, 8)}...${jti.slice(-6)}`;
};

const formatRemaining = (seconds: number): string => {
	if (!Number.isFinite(seconds) || seconds <= 0) return "expired";
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
};

const TOKEN_SESSION_STATUS = {
	active: {
		label: "active",
		dotClass: "bg-emerald-500",
	},
	expired: {
		label: "expired",
		dotClass: "bg-amber-500",
	},
	revoked: {
		label: "revoked",
		dotClass: "bg-rose-500",
	},
	invalidated: {
		label: "invalidated",
		dotClass: "bg-slate-500",
	},
} as const;

export const AdminSessionStatus = ({
	initialSessionStatus,
	initialTokenSessions,
	onLogout,
}: AdminSessionStatusProps) => {
	const [sessionInfo, setSessionInfo] = useState<SessionInfo>(() =>
		sessionInfoFromStatus(initialSessionStatus),
	);
	const [sessions, setSessions] = useState<TokenSession[]>(() =>
		initialTokenSessions?.success ? initialTokenSessions.sessions ?? [] : [],
	);
	const [currentTokenVersion, setCurrentTokenVersion] = useState<number>(
		() => initialTokenSessions?.currentTokenVersion ?? 1,
	);
	const [isRevokingAll, setIsRevokingAll] = useState(false);
	const [revokingJti, setRevokingJti] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState("");
	const [showExpired, setShowExpired] = useState(false);

	const loadStatus = useCallback(async () => {
		const overview = await getAdminSessionOverview();
		if (overview.sessionStatus.success) {
			setSessionInfo(sessionInfoFromStatus(overview.sessionStatus));
		}
		if (overview.success) {
			setSessions(overview.tokenSessions ?? []);
			setCurrentTokenVersion(overview.currentTokenVersion ?? 1);
		}
	}, []);

	useEffect(() => {
		if (initialTokenSessions?.success) {
			return;
		}
		void loadStatus();
	}, [initialTokenSessions?.success, loadStatus]);

	useEffect(() => {
		let intervalId: ReturnType<typeof setInterval> | null = null;

		const stopPolling = () => {
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};

		const startPolling = () => {
			if (intervalId || document.visibilityState !== "visible") {
				return;
			}
			intervalId = setInterval(() => {
				void loadStatus();
			}, 60000);
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void loadStatus();
				startPolling();
				return;
			}
			stopPolling();
		};

		startPolling();
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", handleVisibilityChange);

		return () => {
			stopPolling();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("focus", handleVisibilityChange);
		};
	}, [loadStatus]);

	const handleRevokeSingle = async (jti: string) => {
		if (!window.confirm(`Revoke this session?\n\n${jti}`)) {
			return;
		}

		setRevokingJti(jti);
		setStatusMessage("");
		try {
			const result = await revokeAdminTokenSessionByJti(jti);
			if (!result.success) {
				setStatusMessage(result.error || "Failed to revoke session");
				return;
			}
			setStatusMessage(`Session ${shortJti(jti)} revoked`);
			await loadStatus();
		} finally {
			setRevokingJti(null);
		}
	};

	const handleRevokeAll = async () => {
		if (!window.confirm("Revoke all admin sessions? This signs out all active admins.")) {
			return;
		}

		setIsRevokingAll(true);
		setStatusMessage("");
		try {
			const result = await revokeAllAdminTokenSessionsAction();
			if (!result.success) {
				setStatusMessage(result.error || "Failed to revoke all sessions");
				return;
			}
			setStatusMessage(
				`All admin sessions revoked (token version ${result.nextTokenVersion})`,
			);
			await loadStatus();
		} finally {
			setIsRevokingAll(false);
		}
	};

	const handleLogout = async () => {
		await onLogout();
	};

	const status = getSessionBadge(sessionInfo.expiresAt);

	const counts = useMemo(() => {
		const active = sessions.filter((session) => session.status === "active").length;
		const inactive = sessions.length - active;
		return { active, inactive, total: sessions.length };
	}, [sessions]);

	if (!sessionInfo.isValid) {
		return null;
	}

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-2">
				<div className="flex items-center justify-between gap-3">
					<div>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5" />
							Admin Session
						</CardTitle>
						<CardDescription>
							JWT cookie-auth with server-side session registry and revoke controls.
						</CardDescription>
					</div>
					<Badge variant={status.variant}>{status.label}</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-4">
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Expires In
						</p>
						<p className="mt-1 text-sm font-medium">
							{sessionInfo.expiresIn || "Expired"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Session Age
						</p>
						<p className="mt-1 text-sm font-medium">
							{sessionInfo.sessionAge || "Unknown"}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Token Version
						</p>
						<p className="mt-1 text-sm font-medium">{currentTokenVersion}</p>
					</div>
					<div className="rounded-md border bg-background/60 p-3">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Tracked Sessions
						</p>
						<p className="mt-1 text-sm font-medium">
							{counts.active} active / {counts.total} total
						</p>
					</div>
				</div>

				<div className="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
					<Clock3 className="mr-1 inline h-3.5 w-3.5" />
					Current session: {sessionInfo.jti ? shortJti(sessionInfo.jti) : "Unknown"}
					{sessionInfo.expiresAt ? ` • Expires ${new Date(sessionInfo.expiresAt).toLocaleString()}` : ""}
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						onClick={handleRevokeAll}
						variant="outline"
						size="sm"
						disabled={isRevokingAll}
					>
						{isRevokingAll ? "Revoking..." : "Revoke All Sessions"}
					</Button>
					<Button
						onClick={handleLogout}
						variant="outline"
						size="sm"
						className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
					>
						<LogOut className="h-4 w-4" />
						Logout
					</Button>
				</div>

				<div className="rounded-md border bg-background/60 p-3">
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Token Sessions
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Expandable JWT session records (jti, expiry, ip, user-agent). Expired records are kept for 7 days then removed by a daily cron.
					</p>

					{(() => {
						const expiredCount = sessions.filter((s) => s.status === "expired").length;
						const visibleSessions = showExpired
							? sessions
							: sessions.filter((s) => s.status !== "expired");
						return (
							<>
								{expiredCount > 0 && (
									<div className="mt-2 flex items-center gap-2">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-auto py-1 text-xs text-muted-foreground hover:text-foreground"
											onClick={() => setShowExpired((v) => !v)}
										>
											{showExpired
												? "Hide expired"
												: `Show ${expiredCount} expired`}
										</Button>
									</div>
								)}
								<div className="mt-3 space-y-2">
									{visibleSessions.length === 0 ? (
										<p className="text-xs text-muted-foreground">
											{sessions.length === 0
												? "No tracked sessions yet."
												: "No non-expired sessions. Toggle “Show expired” to see expired records (cleaned up after 7 days by cron)."}
										</p>
									) : (
										visibleSessions.map((session) => {
								const expiresIn = session.exp - Math.floor(Date.now() / 1000);
								const issuedAgo = Math.max(0, Math.floor(Date.now() / 1000) - session.iat);
								const statusDef = TOKEN_SESSION_STATUS[session.status];

								return (
									<details key={session.jti} className="rounded-md border bg-background/80 p-3">
										<summary className="cursor-pointer list-none">
											<div className="flex items-center justify-between gap-3">
												<div className="min-w-0">
													<p className="truncate text-sm font-medium">
														<span className="inline-flex items-center gap-2">
															<span className={`h-1.5 w-1.5 rounded-full ${statusDef.dotClass}`} />
															<span>{shortJti(session.jti)} • {statusDef.label}</span>
														</span>
													</p>
													<p className="truncate text-xs text-muted-foreground">
														issued {formatRemaining(issuedAgo)} ago • expires in {formatRemaining(expiresIn)}
													</p>
												</div>
												<span className="shrink-0 text-xs text-muted-foreground">details</span>
											</div>
										</summary>

										<div className="mt-3 space-y-2 border-t pt-3 text-xs text-muted-foreground">
											<p>jti: <span className="text-foreground">{session.jti}</span></p>
											<p>token version: <span className="text-foreground">{session.tv}</span></p>
											<p>issued at: <span className="text-foreground">{new Date(session.iat * 1000).toLocaleString()}</span></p>
											<p>expires at: <span className="text-foreground">{new Date(session.exp * 1000).toLocaleString()}</span></p>
											<p>ip: <span className="text-foreground">{session.ip || "unknown"}</span></p>
											<p className="break-words">user-agent: <span className="text-foreground">{session.ua || "unknown"}</span></p>
											<div className="flex justify-end">
												<Button
													type="button"
													size="sm"
													variant="outline"
													disabled={session.status !== "active" || revokingJti === session.jti}
													onClick={() => void handleRevokeSingle(session.jti)}
												>
													{revokingJti === session.jti ? "Revoking..." : "Revoke"}
												</Button>
											</div>
										</div>
									</details>
								);
							})
									)}
								</div>
							</>
						);
					})()}
				</div>

				{statusMessage && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
						{statusMessage}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
