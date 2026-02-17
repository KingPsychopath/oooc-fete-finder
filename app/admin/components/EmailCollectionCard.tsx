import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { EmailRecord } from "../types";

type EmailCollectionCardProps = {
	emails: EmailRecord[];
	onCopyEmails: () => void;
	onExportCSV: () => void;
};

export const EmailCollectionCard = ({
	emails,
	onCopyEmails,
	onExportCSV,
}: EmailCollectionCardProps) => {
	const consentedCount = emails.filter((entry) => entry.consent).length;
	const notConsentedCount = emails.length - consentedCount;

	return (
		<Card className="border-white/20 bg-white/90 backdrop-blur-sm">
			<CardHeader className="space-y-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle>Collected Users</CardTitle>
						<CardDescription>
							Newsletter and community signups captured by the site.
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button onClick={onCopyEmails} variant="outline" size="sm">
							Copy Emails
						</Button>
						<Button onClick={onExportCSV} size="sm">
							Export CSV
						</Button>
					</div>
				</div>
				<div className="grid grid-cols-3 gap-2">
					<div className="rounded-md border bg-background/60 px-3 py-2">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Total
						</p>
						<p className="mt-1 text-sm font-medium">{emails.length}</p>
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
			</CardHeader>
			<CardContent>
				{emails.length === 0 ? (
					<div className="rounded-md border bg-background/60 px-3 py-10 text-center text-sm text-muted-foreground">
						No users captured yet.
					</div>
				) : (
					<div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
						{emails.map((user) => (
							<div
								key={`${user.email}-${user.timestamp}`}
								className="rounded-md border bg-background/60 p-3"
							>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">
											{user.firstName} {user.lastName}
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{user.email}
										</p>
									</div>
									<Badge variant={user.consent ? "default" : "destructive"}>
										{user.consent ? "Consented" : "No consent"}
									</Badge>
								</div>
								<div className="mt-2 text-xs text-muted-foreground">
									{new Date(user.timestamp).toLocaleString()} • {user.source}
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
