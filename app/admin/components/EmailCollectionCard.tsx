"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	CheckSquare,
	Copy,
	Download,
	RefreshCw,
	Search,
	Trash2,
	Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
	EmailRecord,
	UserCollectionAnalytics,
	UserCollectionStoreSummary,
} from "../types";

type EmailSortMode =
	| "newest"
	| "oldest"
	| "email"
	| "name"
	| "consented"
	| "likely-test";

type EmailFilterMode = "all" | "consented" | "no-consent" | "likely-test";

type EmailMutationResult = {
	success: boolean;
	error?: string;
	deletedCount?: number;
	importedCount?: number;
	updatedCount?: number;
	skippedCount?: number;
};

type EmailCollectionCardProps = {
	emails: EmailRecord[];
	store: UserCollectionStoreSummary | null;
	analytics: UserCollectionAnalytics | null;
	onCopyEmails: (emails: EmailRecord[]) => void;
	onExportCSV: () => void;
	onRefresh: () => Promise<void>;
	onDeleteEmails: (emails: string[]) => Promise<EmailMutationResult>;
	onImportEmails: (rawInput: string) => Promise<EmailMutationResult>;
};

const TEST_EMAIL_HINTS = [
	"test",
	"example",
	"demo",
	"fake",
	"dummy",
	"localhost",
	"invalid",
];

const isLikelyTestEmail = (email: string): boolean => {
	const normalized = email.toLowerCase();
	return TEST_EMAIL_HINTS.some((hint) => normalized.includes(hint));
};

const compareStrings = (left: string, right: string): number =>
	left.localeCompare(right, undefined, { sensitivity: "base" });

const sortEmails = (emails: EmailRecord[], sortMode: EmailSortMode) => {
	return [...emails].sort((left, right) => {
		switch (sortMode) {
			case "oldest":
				return (
					new Date(left.timestamp).getTime() -
					new Date(right.timestamp).getTime()
				);
			case "email":
				return compareStrings(left.email, right.email);
			case "name":
				return compareStrings(
					`${left.firstName} ${left.lastName}`.trim() || left.email,
					`${right.firstName} ${right.lastName}`.trim() || right.email,
				);
			case "consented":
				return Number(right.consent) - Number(left.consent);
			case "likely-test":
				return (
					Number(isLikelyTestEmail(right.email)) -
					Number(isLikelyTestEmail(left.email))
				);
			default:
				return (
					new Date(right.timestamp).getTime() -
					new Date(left.timestamp).getTime()
				);
		}
	});
};

export const EmailCollectionCard = ({
	emails,
	store,
	analytics,
	onCopyEmails,
	onExportCSV,
	onRefresh,
	onDeleteEmails,
	onImportEmails,
}: EmailCollectionCardProps) => {
	const [query, setQuery] = useState("");
	const [sortMode, setSortMode] = useState<EmailSortMode>("newest");
	const [filterMode, setFilterMode] = useState<EmailFilterMode>("all");
	const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
	const [importText, setImportText] = useState("");
	const [statusMessage, setStatusMessage] = useState("");
	const [isBusy, setIsBusy] = useState(false);
	const consentedCount = analytics?.consentedUsers ?? 0;
	const notConsentedCount = analytics?.nonConsentedUsers ?? 0;
	const likelyTestCount = emails.filter((user) =>
		isLikelyTestEmail(user.email),
	).length;

	const filteredEmails = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		const filtered = emails.filter((user) => {
			if (filterMode === "consented" && !user.consent) return false;
			if (filterMode === "no-consent" && user.consent) return false;
			if (filterMode === "likely-test" && !isLikelyTestEmail(user.email)) {
				return false;
			}
			if (!normalizedQuery) return true;
			return [
				user.firstName,
				user.lastName,
				user.email,
				user.source,
				user.timestamp,
			]
				.join(" ")
				.toLowerCase()
				.includes(normalizedQuery);
		});
		return sortEmails(filtered, sortMode);
	}, [emails, filterMode, query, sortMode]);

	const visibleEmailSet = useMemo(
		() => new Set(filteredEmails.map((user) => user.email)),
		[filteredEmails],
	);
	const visibleSelectedCount = selectedEmails.filter((email) =>
		visibleEmailSet.has(email),
	).length;
	const allVisibleSelected =
		filteredEmails.length > 0 && visibleSelectedCount === filteredEmails.length;

	const handleToggleEmail = (email: string) => {
		setSelectedEmails((current) =>
			current.includes(email)
				? current.filter((selectedEmail) => selectedEmail !== email)
				: [...current, email],
		);
	};

	const handleToggleVisible = () => {
		setSelectedEmails((current) => {
			if (allVisibleSelected) {
				return current.filter((email) => !visibleEmailSet.has(email));
			}
			return Array.from(
				new Set([...current, ...filteredEmails.map((user) => user.email)]),
			);
		});
	};

	const handleDeleteSelected = async () => {
		if (selectedEmails.length === 0) return;
		const confirmed = window.confirm(
			`Delete ${selectedEmails.length} collected email record(s)? This cannot be undone.`,
		);
		if (!confirmed) return;

		setIsBusy(true);
		setStatusMessage("Deleting selected emails...");
		const result = await onDeleteEmails(selectedEmails);
		if (result.success) {
			setStatusMessage(`Deleted ${result.deletedCount ?? 0} email record(s).`);
			setSelectedEmails([]);
			await onRefresh();
		} else {
			setStatusMessage(result.error || "Delete failed.");
		}
		setIsBusy(false);
	};

	const handleImport = async () => {
		if (!importText.trim()) return;

		setIsBusy(true);
		setStatusMessage("Importing email records...");
		const result = await onImportEmails(importText);
		if (result.success) {
			setStatusMessage(
				`Imported ${result.importedCount ?? 0}, updated ${
					result.updatedCount ?? 0
				}, skipped ${result.skippedCount ?? 0}.`,
			);
			setImportText("");
			await onRefresh();
		} else {
			setStatusMessage(result.error || "Import failed.");
		}
		setIsBusy(false);
	};

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Collected User Emails</CardTitle>
						<CardDescription>
							Auth modal submissions are stored in your managed user store and
							can be copied, exported, imported, or tidied here.
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() => void onRefresh()}
							variant="outline"
							size="sm"
							disabled={isBusy}
						>
							<RefreshCw className="size-4" />
							Refresh
						</Button>
						<Button
							onClick={() => onCopyEmails(filteredEmails)}
							variant="outline"
							size="sm"
							disabled={filteredEmails.length === 0}
						>
							<Copy className="size-4" />
							Copy Visible
						</Button>
						<Button onClick={onExportCSV} size="sm">
							<Download className="size-4" />
							Export CSV
						</Button>
					</div>
				</div>
				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Unique Users
						</p>
						<p className="mt-1 text-sm font-medium">{emails.length}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Total Submissions
						</p>
						<p className="mt-1 text-sm font-medium">
							{analytics?.totalSubmissions ?? emails.length}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Likely Tests
						</p>
						<p className="mt-1 text-sm font-medium">{likelyTestCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Event Backups
						</p>
						<p className="mt-1 text-sm font-medium">Emails included</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Last 24h
						</p>
						<p className="mt-1 text-sm font-medium">
							{analytics?.submissionsLast24Hours ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Last 7d
						</p>
						<p className="mt-1 text-sm font-medium">
							{analytics?.submissionsLast7Days ?? 0}
						</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Consented
						</p>
						<p className="mt-1 text-sm font-medium">{consentedCount}</p>
					</div>
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							No Consent
						</p>
						<p className="mt-1 text-sm font-medium">{notConsentedCount}</p>
					</div>
				</div>
				<div className="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
					<p className="break-all">
						Store path: {store?.location || "Unavailable"}
					</p>
					<p className="mt-1">
						Last updated:{" "}
						{store?.lastUpdatedAt
							? new Date(store.lastUpdatedAt).toLocaleString()
							: "Never"}
					</p>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_9rem_9rem]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted-foreground" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search name, email, source..."
							className="pl-8"
						/>
					</div>
					<select
						value={filterMode}
						onChange={(event) =>
							setFilterMode(event.target.value as EmailFilterMode)
						}
						className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="all">All records</option>
						<option value="consented">Consented</option>
						<option value="no-consent">No consent</option>
						<option value="likely-test">Likely tests</option>
					</select>
					<select
						value={sortMode}
						onChange={(event) =>
							setSortMode(event.target.value as EmailSortMode)
						}
						className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<option value="newest">Newest first</option>
						<option value="oldest">Oldest first</option>
						<option value="email">Email A-Z</option>
						<option value="name">Name A-Z</option>
						<option value="consented">Consent first</option>
						<option value="likely-test">Tests first</option>
					</select>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 px-3 py-2">
					<p className="text-xs text-muted-foreground">
						Showing {filteredEmails.length} of {emails.length}; selected{" "}
						{selectedEmails.length}.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleToggleVisible}
							disabled={filteredEmails.length === 0}
						>
							<CheckSquare className="size-4" />
							{allVisibleSelected ? "Clear Visible" : "Select Visible"}
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={() => void handleDeleteSelected()}
							disabled={isBusy || selectedEmails.length === 0}
						>
							<Trash2 className="size-4" />
							Delete Selected
						</Button>
					</div>
				</div>

				<div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
					<Textarea
						value={importText}
						onChange={(event) => setImportText(event.target.value)}
						placeholder="Paste CSV with an Email column, or one email per line"
						className="min-h-20"
					/>
					<Button
						type="button"
						onClick={() => void handleImport()}
						disabled={isBusy || !importText.trim()}
						className="self-start"
					>
						<Upload className="size-4" />
						Import
					</Button>
				</div>

				{statusMessage && (
					<div className="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
						{statusMessage}
					</div>
				)}

				{filteredEmails.length === 0 ? (
					<div className="rounded-md border bg-background/60 px-3 py-10 text-center text-sm text-muted-foreground">
						No matching users.
					</div>
				) : (
					<div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
						{filteredEmails.map((user) => {
							const isSelected = selectedEmails.includes(user.email);
							const isTest = isLikelyTestEmail(user.email);
							return (
								<label
									key={`${user.email}-${user.timestamp}`}
									className="flex cursor-pointer gap-3 rounded-md border bg-background/60 p-3 transition-colors hover:bg-muted/40"
								>
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => handleToggleEmail(user.email)}
										className="mt-1 size-4 rounded border-input"
									/>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-start justify-between gap-2">
											<span className="min-w-0">
												<span className="block truncate text-sm font-medium">
													{user.firstName || user.lastName
														? `${user.firstName} ${user.lastName}`.trim()
														: "No name"}
												</span>
												<span className="block truncate text-xs text-muted-foreground">
													{user.email}
												</span>
											</span>
											<span className="flex flex-wrap gap-1.5">
												{isTest && <Badge variant="outline">Likely test</Badge>}
												<Badge
													variant={user.consent ? "default" : "destructive"}
												>
													{user.consent ? "Consented" : "No consent"}
												</Badge>
											</span>
										</span>
										<span className="mt-2 block text-xs text-muted-foreground">
											{new Date(user.timestamp).toLocaleString()} ·{" "}
											{user.source}
										</span>
									</span>
								</label>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
