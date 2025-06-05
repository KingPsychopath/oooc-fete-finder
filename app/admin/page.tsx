"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCollectedEmails } from "@/app/actions";

type EmailRecord = {
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
};

const AdminPage = () => {
	const [adminKey, setAdminKey] = useState("");
	const [emails, setEmails] = useState<EmailRecord[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const result = await getCollectedEmails(adminKey);
			
			if (result.success) {
				setEmails(result.emails || []);
				setIsAuthenticated(true);
			} else {
				setError(result.error || "Failed to fetch emails");
			}
		} catch {
			setError("Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	const exportAsCSV = () => {
		const csvContent = [
			["Email", "Timestamp", "Consent", "Source"],
			...emails.map(email => [
				email.email,
				email.timestamp,
				email.consent.toString(),
				email.source
			])
		];
		
		const csvString = csvContent.map(row => row.join(",")).join("\n");
		const blob = new Blob([csvString], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		
		const a = document.createElement("a");
		a.href = url;
		a.download = `fete-finder-emails-${new Date().toISOString().split('T')[0]}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const copyEmails = () => {
		const emailList = emails.map(e => e.email).join("\n");
		navigator.clipboard.writeText(emailList);
		alert("Emails copied to clipboard!");
	};

	if (!isAuthenticated) {
		return (
			<div className="container mx-auto max-w-md py-8">
				<h1 className="text-2xl font-bold mb-6">Admin Access</h1>
				
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label htmlFor="adminKey">Admin Key</Label>
						<Input
							id="adminKey"
							type="password"
							value={adminKey}
							onChange={(e) => setAdminKey(e.target.value)}
							placeholder="Enter admin key"
						/>
					</div>
					
					{error && <p className="text-red-500 text-sm">{error}</p>}
					
					<Button type="submit" disabled={isLoading} className="w-full">
						{isLoading ? "Verifying..." : "Access Emails"}
					</Button>
				</form>
				
				<p className="text-sm text-gray-500 mt-4">
					Default key: your-secret-key-123 (change via ADMIN_KEY env var)
				</p>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-8">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-2xl font-bold">Collected Emails ({emails.length})</h1>
				<div className="space-x-2">
					<Button onClick={copyEmails} variant="outline">
						Copy All Emails
					</Button>
					<Button onClick={exportAsCSV}>
						Export CSV
					</Button>
				</div>
			</div>
			
			{emails.length === 0 ? (
				<p className="text-gray-500">No emails collected yet.</p>
			) : (
				<div className="space-y-4">
					{emails.map((email, index) => (
						<div key={index} className="border p-4 rounded-lg">
							<div className="font-mono text-lg">{email.email}</div>
							<div className="text-sm text-gray-500 mt-1">
								{new Date(email.timestamp).toLocaleString()} | 
								Consent: {email.consent ? "✅" : "❌"} | 
								Source: {email.source}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default AdminPage; 