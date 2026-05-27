"use client";

import {
	deleteCollectedEmails,
	exportCollectedEmailsCsv,
	getCollectedEmails,
	getCollectedUserProfile,
	importCollectedEmails,
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

type InsightsTab = "traffic" | "discovery" | "events" | "audience" | "advanced";

const INSIGHTS_TABS: Array<{
	key: InsightsTab;
	label: string;
	description: string;
}> = [
	{
		key: "traffic",
		label: "Traffic",
		description: "Visitors, sources, campaigns, landing pages.",
	},
	{
		key: "discovery",
		label: "Discovery",
		description: "Search, filters, map, sort, location, tour.",
	},
	{
		key: "events",
		label: "Events",
		description: "Event attention, intent, funnel, quality.",
	},
	{
		key: "audience",
		label: "Audience",
		description: "Segments, exports, collected users.",
	},
	{
		key: "advanced",
		label: "Advanced",
		description: "Diagnostics, raw dimensions, full table.",
	},
];

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
	const [emailStore, setEmailStore] =
		useState<UserCollectionStoreSummary | null>(
			initialEmailsResult?.success ? (initialEmailsResult.store ?? null) : null,
		);
	const [emailAnalytics, setEmailAnalytics] =
		useState<UserCollectionAnalytics | null>(
			initialEmailsResult?.success
				? (initialEmailsResult.analytics ?? null)
				: null,
		);
	const [activeTab, setActiveTab] = useState<InsightsTab>("traffic");

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

	const copyVisibleEmails = useCallback((visibleEmails: EmailRecord[]) => {
		const emailList = visibleEmails.map((entry) => entry.email).join("\n");
		navigator.clipboard.writeText(emailList);
	}, []);

	const emailCollectionSection =
		activeTab === "audience" ? (
			<section id="collected-users" className="scroll-mt-44">
				<EmailCollectionCard
					emails={emails}
					store={emailStore}
					analytics={emailAnalytics}
					onCopyEmails={copyVisibleEmails}
					onExportCSV={() => void exportAsCSV()}
					onRefresh={loadEmails}
					onDeleteEmails={deleteCollectedEmails}
					onImportEmails={importCollectedEmails}
					onGetUserProfile={getCollectedUserProfile}
				/>
			</section>
		) : null;

	return (
		<div className="space-y-6">
			<div className="ooo-admin-card-soft rounded-md border p-3">
				<div className="flex flex-wrap gap-2">
					{INSIGHTS_TABS.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={`rounded-md border px-3 py-2 text-left transition-colors ${
								activeTab === tab.key
									? "border-foreground/35 bg-foreground text-background"
									: "bg-background/70 text-foreground hover:bg-accent"
							}`}
						>
							<span className="block text-xs font-semibold">{tab.label}</span>
							<span
								className={`block text-[11px] ${
									activeTab === tab.key
										? "text-background/75"
										: "text-muted-foreground"
								}`}
							>
								{tab.description}
							</span>
						</button>
					))}
				</div>
			</div>
			{emailCollectionSection}
			<section id="event-engagement-stats" className="scroll-mt-44">
				<EventEngagementStatsCard
					initialPayload={initialData.eventEngagementDashboard}
					activeTab={activeTab}
				/>
			</section>
		</div>
	);
}
