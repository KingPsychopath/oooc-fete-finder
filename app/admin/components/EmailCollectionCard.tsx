import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmailRecord } from "../types";

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
	return (
		<Card>
			<CardHeader>
				<div className="flex justify-between items-center">
					<div>
						<CardTitle>📧 Collected Emails ({emails.length})</CardTitle>
						<CardDescription>
							User email addresses collected with consent
						</CardDescription>
					</div>
					<div className="space-x-2">
						<Button onClick={onCopyEmails} variant="outline" size="sm">
							📋 Copy All
						</Button>
						<Button onClick={onExportCSV} size="sm">
							📥 Export CSV
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{emails.length === 0 ? (
					<p className="text-gray-500 text-center py-8">
						No emails collected yet.
					</p>
				) : (
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{emails.map((email, index) => (
							<div key={index} className="border p-3 rounded-lg">
								<div className="font-mono text-lg">{email.email}</div>
								<div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
									<span>{new Date(email.timestamp).toLocaleString()}</span>
									<span>•</span>
									<Badge
										variant={email.consent ? "default" : "destructive"}
										className="text-xs"
									>
										{email.consent ? "✅ Consented" : "❌ No Consent"}
									</Badge>
									<span>•</span>
									<span>{email.source}</span>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
