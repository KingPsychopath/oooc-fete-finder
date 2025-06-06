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
						<CardTitle>👥 Collected Users ({emails.length})</CardTitle>
						<CardDescription>
							User information collected with consent
						</CardDescription>
					</div>
					<div className="space-x-2">
						<Button onClick={onCopyEmails} variant="outline" size="sm">
							📋 Copy Emails
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
						No users registered yet.
					</p>
				) : (
					<div className="space-y-3 max-h-96 overflow-y-auto">
						{emails.map((user, index) => (
							<div key={index} className="border p-3 rounded-lg">
								<div className="flex items-center justify-between">
									<div>
										<div className="font-semibold text-lg">
											{user.firstName} {user.lastName}
										</div>
										<div className="font-mono text-sm text-gray-600">
											{user.email}
										</div>
									</div>
									<Badge
										variant={user.consent ? "default" : "destructive"}
										className="text-xs"
									>
										{user.consent ? "✅ Consented" : "❌ No Consent"}
									</Badge>
								</div>
								<div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
									<span>{new Date(user.timestamp).toLocaleString()}</span>
									<span>•</span>
									<span>{user.source}</span>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
