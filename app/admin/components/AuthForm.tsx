import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

type AuthFormProps = {
	onSubmit: (e: React.FormEvent) => void;
	isLoading: boolean;
	error: string;
	adminKey: string;
	setAdminKey: React.Dispatch<React.SetStateAction<string>>;
};

export const AuthForm = ({
	onSubmit,
	isLoading,
	error,
	adminKey,
	setAdminKey,
}: AuthFormProps) => {
	return (
		<div className="container mx-auto max-w-md py-8">
			<h1 className="text-2xl font-bold mb-6">Admin Access</h1>

			<form onSubmit={onSubmit} className="space-y-4">
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
					{isLoading ? "Verifying..." : "Access Admin Panel"}
				</Button>
			</form>

			<p className="text-sm text-gray-500 mt-4">
				Default key: your-secret-key-123 (change via ADMIN_KEY env var)
			</p>
		</div>
	);
};
