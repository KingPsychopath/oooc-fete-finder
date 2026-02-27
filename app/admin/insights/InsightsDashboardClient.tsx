"use client";

import {
	exportCollectedEmailsCsv,
	getCollectedEmails,
} from "@/features/auth/actions";
import { useCallback, useEffect, useState } from "react";
import { EmailCollectionCard } from "../components/EmailCollectionCard";
import { EventEngagementStatsCard } from "../components/EventEngagementStatsCard";
import type {
	AdminInsightsInitialData,
	EmailRecord,
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
} from "../types";

type InsightsDashboardClientProps = {
	initialData: AdminInsightsInitialData;
};

export function InsightsDashboardClient({
	initialData,
}: InsightsDashboardClientProps) {
	const initialEmailsResult = initialData.emailsResult;
	const [emails, setEmails] = useState<EmailRecord[]>(
		initialEmailsResult?.success ? (initialEmailsResult.emails ?? []) : [],
	);
	const [emailStore, setEmailStore] = useState<UserCollectionStoreSummary | null>(
		initialEmailsResult?.success ? (initialEmailsResult.store ?? null) : null,
	);
	const [emailAnalytics, setEmailAnalytics] =
		useState<UserCollectionAnalytics | null>(
			initialEmailsResult?.success
				? (initialEmailsResult.analytics ?? null)
				: null,
		);

	const loadEmails = useCallback(async () => {
		const result = await getCollectedEmails();
		if (result.success) {
			setEmails(result.emails ?? []);
			setEmailStore(result.store ?? null);
			setEmailAnalytics(result.analytics ?? null);
		}
	}, []);

	useEffect(() => {
		if (initialEmailsResult?.success) {
			return;
		}
		void loadEmails();
	}, [initialEmailsResult?.success, loadEmails]);

	const exportAsCSV = useCallback(async () => {
		const result = await exportCollectedEmailsCsv();
		if (!result.success || !result.csv) return;
		const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download =
			result.filename ??
			`fete-finder-users-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}, []);

	const copyEmails = useCallback(() => {
		const emailList = emails.map((entry) => entry.email).join("\n");
		navigator.clipboard.writeText(emailList);
	}, [emails]);

	return (
		<div className="space-y-6">
			<section id="event-engagement-stats" className="scroll-mt-44">
				<EventEngagementStatsCard
					initialPayload={initialData.eventEngagementDashboard}
				/>
			</section>

			<section id="collected-users" className="scroll-mt-44">
				<EmailCollectionCard
					emails={emails}
					store={emailStore}
					analytics={emailAnalytics}
					onCopyEmails={copyEmails}
					onExportCSV={() => void exportAsCSV()}
				/>
			</section>
		</div>
	);
}
