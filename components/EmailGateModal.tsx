import React, { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock } from "lucide-react";

type EmailGateModalProps = {
	isOpen: boolean;
	onEmailSubmit: (email: string) => void;
	onClose?: () => void;
};

const EmailGateModal = ({
	isOpen,
	onEmailSubmit,
	onClose,
}: EmailGateModalProps) => {
	const [email, setEmail] = useState("");
	const [consent, setConsent] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const validateEmail = (email: string) => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email.trim()) {
			setError("Please enter your email address");
			return;
		}

		if (!validateEmail(email)) {
			setError("Please enter a valid email address");
			return;
		}

		if (!consent) {
			setError("Please accept our privacy policy to continue");
			return;
		}

		setIsSubmitting(true);
		setError("");

		try {
			// Optional: Send email to backend API
			try {
				await fetch("/api/auth", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email, consent: true }),
				});
			} catch (apiError) {
				// If API fails, we still proceed with local storage
				console.warn("Failed to store email in backend:", apiError);
			}

			// Proceed with local authentication
			onEmailSubmit(email);
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Lock className="h-5 w-5" />
						Access Required
					</DialogTitle>
					<DialogDescription>
						To use filters and explore events, please provide your email
						address. We'll use this to improve our recommendations and keep you
						updated on future events.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email Address</Label>
						<div className="relative">
							<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="email"
								type="email"
								placeholder="your@email.com"
								value={email}
								onChange={(e) => {
									setEmail(e.target.value);
									setError("");
								}}
								className="pl-10"
								disabled={isSubmitting}
								autoFocus
							/>
						</div>
					</div>

					{/* GDPR Consent */}
					<div className="flex items-start space-x-2">
						<input
							id="consent"
							type="checkbox"
							checked={consent}
							onChange={(e) => {
								setConsent(e.target.checked);
								setError("");
							}}
							className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
							disabled={isSubmitting}
						/>
						<Label
							htmlFor="consent"
							className="text-xs leading-relaxed cursor-pointer"
						>
							I agree to the collection and processing of my email address for
							event recommendations and updates.{" "}
							<button
								type="button"
								onClick={() => window.open("/privacy", "_blank")}
								className="text-primary underline hover:no-underline whitespace-nowrap"
							>
								Read our Privacy Policy
							</button>
						</Label>
					</div>

					{error && <p className="text-sm text-destructive">{error}</p>}

					<div className="flex flex-col gap-2">
						<Button
							type="submit"
							className="w-full"
							disabled={isSubmitting || !consent}
						>
							{isSubmitting ? "Verifying..." : "Continue to Events"}
						</Button>
						<p className="text-xs text-muted-foreground text-center">
							Your data is secure and will only be used as described in our
							privacy policy.
						</p>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default EmailGateModal;
