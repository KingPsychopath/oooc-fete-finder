"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { useOptionalAuth } from "@/features/auth/auth-context";
import { normalizeNoticeCtaHref } from "@/features/users/notice-form";
import type { PublicUserNotice } from "@/features/users/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, ShieldAlert, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const LOCAL_DISMISSED_KEY = "oooc:user-notices:dismissed:v1";

const readLocalDismissed = (): Set<string> => {
	if (typeof window === "undefined") return new Set();
	try {
		const parsed = JSON.parse(
			window.localStorage.getItem(LOCAL_DISMISSED_KEY) ?? "[]",
		);
		return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
	} catch {
		return new Set();
	}
};

const writeLocalDismissed = (noticeIds: Set<string>): void => {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		LOCAL_DISMISSED_KEY,
		JSON.stringify(Array.from(noticeIds).slice(-100)),
	);
};

const formatExpiry = (value: string | null): string | null => {
	if (!value) return null;
	try {
		return new Intl.DateTimeFormat("en-GB", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(value));
	} catch {
		return value;
	}
};

const noticeStyle = (severity: PublicUserNotice["severity"]) => {
	switch (severity) {
		case "critical":
			return {
				icon: ShieldAlert,
				label: "Critical notice",
				className: "ooo-notice-card--critical",
			};
		case "action_required":
			return {
				icon: AlertTriangle,
				label: "Action required",
				className: "ooo-notice-card--action-required",
			};
		case "warning":
			return {
				icon: AlertTriangle,
				label: "Heads up",
				className: "ooo-notice-card--warning",
			};
		case "success":
			return {
				icon: Check,
				label: "Good news",
				className: "ooo-notice-card--success",
			};
		case "info":
		default:
			return {
				icon: Sparkles,
				label: "Site notice",
				className: "ooo-notice-card--info",
			};
	}
};

export function UserNoticeCenter() {
	const { isAuthResolved, isAuthenticated } = useOptionalAuth();
	const [notices, setNotices] = useState<PublicUserNotice[]>([]);
	const [isLoaded, setIsLoaded] = useState(false);

	const loadNotices = useCallback(async () => {
		try {
			const response = await fetch(`${basePath}/api/user/notices`, {
				method: "GET",
				cache: "no-store",
			});
			if (!response.ok) return;
			const payload = (await response.json()) as {
				success?: boolean;
				notices?: PublicUserNotice[];
			};
			const localDismissed = readLocalDismissed();
			setNotices(
				(payload.notices ?? []).filter(
					(notice) => !localDismissed.has(notice.id),
				),
			);
		} finally {
			setIsLoaded(true);
		}
	}, []);

	useEffect(() => {
		if (!isAuthResolved) return;
		void loadNotices();
	}, [isAuthResolved, loadNotices]);

	const postReceipt = useCallback(
		async (noticeId: string, action: "read" | "dismiss" | "acknowledge") => {
			if (!isAuthenticated) return;
			await fetch(`${basePath}/api/user/notices`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ noticeId, action }),
			});
		},
		[isAuthenticated],
	);

	useEffect(() => {
		if (!isLoaded || notices.length === 0 || !isAuthenticated) return;
		for (const notice of notices) {
			if (!notice.receipt?.readAt) {
				void postReceipt(notice.id, "read");
			}
		}
	}, [isAuthenticated, isLoaded, notices, postReceipt]);

	const visibleNotices = useMemo(() => notices.slice(0, 3), [notices]);

	const removeNotice = useCallback(
		(noticeId: string) => {
			setNotices((current) =>
				current.filter((notice) => notice.id !== noticeId),
			);
			if (!isAuthenticated) {
				const dismissed = readLocalDismissed();
				dismissed.add(noticeId);
				writeLocalDismissed(dismissed);
			}
		},
		[isAuthenticated],
	);

	if (!isLoaded || visibleNotices.length === 0) return null;

	return (
		<div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-xl flex-col gap-2 sm:bottom-4 sm:right-4 sm:left-auto sm:mx-0 sm:w-[min(28rem,calc(100vw-2rem))]">
			{visibleNotices.map((notice) => {
				const style = noticeStyle(notice.severity);
				const Icon = style.icon;
				const canDismiss = notice.dismissible && !notice.requiresAck;
				const expiryLabel = formatExpiry(notice.expiresAt);
				const ctaHref = normalizeNoticeCtaHref(notice.ctaHref);
				const acknowledge = async () => {
					await postReceipt(notice.id, "acknowledge");
					removeNotice(notice.id);
				};
				const dismiss = async () => {
					await postReceipt(notice.id, "dismiss");
					removeNotice(notice.id);
				};

				return (
					<div
						key={notice.id}
						className={cn("ooo-notice-card border p-3 pl-4", style.className)}
						role={notice.severity === "critical" ? "alert" : "status"}
					>
						<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
							<div className="ooo-notice-icon mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border">
								<Icon className="size-4" />
							</div>
							<div className="min-w-0">
								<p className="ooo-notice-eyebrow text-[10px] font-medium uppercase tracking-[0.18em]">
									{style.label}
								</p>
								<p className="ooo-notice-title mt-1 text-[1.28rem] leading-[1.04] text-foreground">
									{notice.title}
								</p>
								<p className="mt-2 text-sm leading-snug text-foreground/78">
									{notice.body}
								</p>
								{expiryLabel ? (
									<p className="mt-2 text-xs text-muted-foreground">
										Visible until {expiryLabel}
									</p>
								) : null}
								<div className="mt-3 flex flex-wrap gap-2">
									{ctaHref && notice.ctaLabel ? (
										<Link
											href={ctaHref}
											className={cn(
												buttonVariants({ variant: "outline", size: "sm" }),
												"ooo-notice-secondary-action bg-background/45",
											)}
										>
											{notice.ctaLabel}
										</Link>
									) : null}
									{notice.requiresAck ? (
										<Button
											type="button"
											size="sm"
											variant="outline"
											className="ooo-notice-primary-action"
											onClick={() => void acknowledge()}
										>
											<Check />
											Acknowledge
										</Button>
									) : null}
								</div>
							</div>
							{canDismiss ? (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-7 shrink-0 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
									onClick={() => void dismiss()}
									aria-label="Dismiss notice"
								>
									<X className="size-4" />
								</Button>
							) : (
								<span className="size-7" aria-hidden />
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
