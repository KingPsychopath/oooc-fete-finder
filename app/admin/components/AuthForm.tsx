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
		<div className="min-h-screen bg-[linear-gradient(160deg,#f8f6f3_0%,#ede8e1_45%,#ded6ca_100%)]">
			<div className="container mx-auto max-w-lg px-6 py-20">
				<div className="rounded-2xl border border-white/30 bg-white/80 p-8 shadow-lg backdrop-blur-sm">
					<div className="space-y-2">
						<div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
							Out Of Office
						</div>
						<h1 className="text-3xl font-semibold tracking-tight">Admin Access</h1>
						<p className="text-sm text-muted-foreground">
							Secure access to the event workflow console.
						</p>
					</div>

					<form onSubmit={onSubmit} className="mt-8 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="adminKey">Admin Key</Label>
							<Input
								id="adminKey"
								type="password"
								value={adminKey}
								onChange={(e) => setAdminKey(e.target.value)}
								placeholder="Enter admin key"
								className="h-11"
							/>
						</div>

						{error && <p className="text-red-600 text-sm">{error}</p>}

						<Button type="submit" disabled={isLoading} className="h-11 w-full">
							{isLoading ? "Verifying..." : "Enter Workflow Console"}
						</Button>
					</form>

					<p className="mt-4 text-xs text-muted-foreground">
						Use your `ADMIN_KEY` environment variable.
					</p>
				</div>
			</div>
		</div>
	);
};
