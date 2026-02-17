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
	const handlePasteAdminKey = async () => {
		try {
			const clipboardValue = await navigator.clipboard.readText();
			if (clipboardValue) {
				setAdminKey(clipboardValue.trim());
			}
		} catch {}
	};

	return (
		<div className="ooo-admin-shell">
			<div className="container mx-auto max-w-lg px-6 py-20">
				<div className="ooo-admin-card rounded-2xl p-8 shadow-lg">
					<div className="space-y-2">
						<div className="ooo-admin-kicker">
							Out Of Office
						</div>
						<h1 className="ooo-admin-title text-3xl">Admin Access</h1>
						<p className="text-sm text-muted-foreground">
							Secure access to the event workflow console.
						</p>
					</div>

					<form onSubmit={onSubmit} className="mt-8 space-y-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<Label htmlFor="adminKey">Admin Key</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => void handlePasteAdminKey()}
									className="h-8 px-2 text-xs"
								>
									Paste key
								</Button>
							</div>
							<Input
								id="adminKey"
								type="password"
								value={adminKey}
								onChange={(e) => setAdminKey(e.target.value)}
								onPaste={(e) => {
									const pasted = e.clipboardData.getData("text");
									if (pasted) {
										e.preventDefault();
										setAdminKey(pasted.trim());
									}
								}}
								placeholder="Enter admin key"
								className="h-11"
								autoComplete="current-password"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
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
