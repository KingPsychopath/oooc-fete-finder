"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { factoryResetApplicationState } from "@/features/data-management/actions";

const CONFIRMATION_PHRASE = "RESET EVERYTHING";

interface SystemResetCardProps {
	onResetCompleted?: () => Promise<void> | void;
}

export const SystemResetCard = ({ onResetCompleted }: SystemResetCardProps) => {
	const [stepUpPasscode, setStepUpPasscode] = useState("");
	const [confirmationText, setConfirmationText] = useState("");
	const [isResetting, setIsResetting] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	const handleFactoryReset = useCallback(async () => {
		if (confirmationText.trim() !== CONFIRMATION_PHRASE) {
			setError(`Type "${CONFIRMATION_PHRASE}" to confirm.`);
			setMessage("");
			return;
		}

		const confirmed = window.confirm(
			"This will clear event store, featured queue/history, collected users, submissions, and related caches. Continue?",
		);
		if (!confirmed) {
			return;
		}

		const secondConfirm = window.confirm(
			"Final confirmation: run factory reset now?",
		);
		if (!secondConfirm) {
			return;
		}

		setIsResetting(true);
		setMessage("");
		setError("");
		try {
			const result = await factoryResetApplicationState(
				undefined,
				stepUpPasscode,
			);
			if (!result.success) {
				throw new Error(result.error || result.message);
			}

			const summary = result.summary;
			setMessage(
				summary
					? `${result.message} Cleared ${summary.clearedFeaturedEntries} featured entries, ${summary.clearedEventSubmissions} submissions, ${summary.clearedBackups} backups.`
					: result.message,
			);
			setStepUpPasscode("");
			setConfirmationText("");
			if (onResetCompleted) {
				await onResetCompleted();
			}
		} catch (resetError) {
			setError(
				resetError instanceof Error
					? resetError.message
					: "Unknown reset error",
			);
		} finally {
			setIsResetting(false);
		}
	}, [confirmationText, onResetCompleted, stepUpPasscode]);

	const canSubmit =
		!isResetting &&
		stepUpPasscode.trim().length > 0 &&
		confirmationText.trim().length > 0;

	return (
		<Card className="ooo-admin-card min-w-0 overflow-hidden border-red-200/80">
			<CardHeader className="space-y-2">
				<CardTitle>Factory Reset</CardTitle>
				<CardDescription>
					Danger zone. Resets runtime/admin data to a fresh app state.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
					Use this only when preparing a clean start. This clears managed store,
					featured schedule, collected users, submissions, and cache state.
				</div>

				<div className="space-y-2">
					<Label htmlFor="admin-reset-passcode">Factory reset passcode</Label>
					<Input
						id="admin-reset-passcode"
						type="password"
						value={stepUpPasscode}
						onChange={(event) => setStepUpPasscode(event.target.value)}
						placeholder="Enter ADMIN_RESET_PASSCODE"
						autoComplete="off"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="admin-reset-confirmation">
						Type {CONFIRMATION_PHRASE}
					</Label>
					<Input
						id="admin-reset-confirmation"
						value={confirmationText}
						onChange={(event) => setConfirmationText(event.target.value)}
						placeholder={CONFIRMATION_PHRASE}
						autoComplete="off"
					/>
				</div>

				<Button
					type="button"
					variant="destructive"
					disabled={!canSubmit}
					onClick={handleFactoryReset}
				>
					{isResetting ? "Resetting..." : "Run Factory Reset"}
				</Button>

				{message && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
						{message}
					</div>
				)}
				{error && (
					<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
						{error}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
