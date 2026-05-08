import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type StoredAuthProfile,
	buildSuggestedEmail,
	normalizeEmailInput,
	sanitizePastedEmail,
	sanitizeRecentProfile,
	validateEmail,
} from "@/features/auth/email-gate-utils";
import {
	getClientContext,
	getOrCreateEngagementSessionId,
} from "@/features/events/engagement/client-tracking";
import { Lock, Mail, User } from "lucide-react";
import React, { useEffect, useState } from "react";

type EmailGateModalProps = {
	isOpen: boolean;
	onEmailSubmit: (email: string) => Promise<boolean>;
	onClose?: () => void;
};

const LAST_AUTH_PROFILE_KEY = "oooc_last_auth_profile_v1";
const LAST_AUTH_EMAIL_KEY = "oooc_last_auth_email_v1";

const EmailGateModal = ({
	isOpen,
	onEmailSubmit,
	onClose,
}: EmailGateModalProps) => {
	const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [consent, setConsent] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [isOffline, setIsOffline] = useState(false);
	const [recentProfile, setRecentProfile] = useState<StoredAuthProfile | null>(
		null,
	);

	const validateName = (name: string) => {
		return name.trim().length >= 2;
	};

	useEffect(() => {
		if (typeof navigator === "undefined") return;
		setIsOffline(navigator.onLine === false);

		const handleOnline = () => setIsOffline(false);
		const handleOffline = () => setIsOffline(true);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const storedProfileRaw = window.localStorage.getItem(LAST_AUTH_PROFILE_KEY);
		if (storedProfileRaw) {
			try {
				const parsed = sanitizeRecentProfile(
					JSON.parse(storedProfileRaw) as unknown,
				);
				if (parsed) {
					setRecentProfile(parsed);
					return;
				}
			} catch {}
		}

		const storedEmail = window.localStorage.getItem(LAST_AUTH_EMAIL_KEY);
		if (storedEmail) {
			const clean = storedEmail.trim().toLowerCase();
			if (validateEmail(clean)) {
				setRecentProfile({
					firstName: "",
					lastName: "",
					email: clean,
				});
			}
		}
	}, []);

	const emailSuggestion = buildSuggestedEmail(email);
	const normalizedEmail = normalizeEmailInput(email).toLowerCase();
	const normalizedRecentEmail = recentProfile?.email ?? "";
	const hasRecentEmail =
		normalizedRecentEmail.length > 0 &&
		normalizedRecentEmail !== normalizedEmail &&
		validateEmail(normalizedRecentEmail);
	const canUseRecentProfile =
		recentProfile !== null &&
		!isSubmitting &&
		recentProfile.firstName.length >= 2 &&
		recentProfile.lastName.length >= 2 &&
		(recentProfile.firstName !== firstName.trim() ||
			recentProfile.lastName !== lastName.trim() ||
			recentProfile.email !== normalizedEmail);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const finalEmail = normalizedEmail;

		if (!firstName.trim()) {
			setError("Please enter your first name");
			return;
		}

		if (!validateName(firstName)) {
			setError("First name must be at least 2 characters");
			return;
		}

		if (!lastName.trim()) {
			setError("Please enter your last name");
			return;
		}

		if (!validateName(lastName)) {
			setError("Last name must be at least 2 characters");
			return;
		}

		if (!finalEmail) {
			setError("Please enter your email address");
			return;
		}

		if (!validateEmail(finalEmail)) {
			setError("Please enter a valid email address");
			return;
		}

		if (!consent) {
			setError("Please accept our privacy policy to continue");
			return;
		}

		if (isOffline) {
			setError("You are offline. Reconnect to verify your email.");
			return;
		}

		setIsSubmitting(true);
		setError("");

		try {
			const response = await fetch(`${basePath}/api/auth/verify`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					firstName: firstName.trim(),
					lastName: lastName.trim(),
					email: finalEmail,
					consent: true,
					source: "fete-finder-auth",
					anonymousSessionId: getOrCreateEngagementSessionId(),
					clientContext: getClientContext(),
				}),
				signal: AbortSignal.timeout(12000),
			});
			const result = (await response.json()) as {
				success: boolean;
				error?: string;
			};

			if (result.success) {
				if (typeof window !== "undefined") {
					window.localStorage.setItem(LAST_AUTH_EMAIL_KEY, finalEmail);
					const nextProfile = {
						firstName: firstName.trim(),
						lastName: lastName.trim(),
						email: finalEmail,
					};
					setRecentProfile(nextProfile);
					window.localStorage.setItem(
						LAST_AUTH_PROFILE_KEY,
						JSON.stringify(nextProfile),
					);
				}
				const hasConfirmedSession = await onEmailSubmit(finalEmail);
				if (!hasConfirmedSession) {
					setError(
						"We verified your details, but we couldn't confirm your session yet. Tap Continue once more.",
					);
				}
			} else {
				setError(result.error || "Something went wrong. Please try again.");
			}
		} catch (submitError) {
			if (typeof navigator !== "undefined" && navigator.onLine === false) {
				setError("You are offline. Reconnect to verify your email.");
				return;
			}
			if (
				submitError instanceof Error &&
				(submitError.name === "TimeoutError" ||
					submitError.name === "AbortError")
			) {
				setError("Verification timed out. Please try again.");
				return;
			}
			setError("Verification failed. Please try again.");
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
						To use filters and explore events, please provide your details.
						We'll use this to improve our recommendations and keep you updated
						on future events.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Name Fields */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="firstName">First Name</Label>
							<div className="relative">
								<User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="firstName"
									type="text"
									placeholder="John"
									value={firstName}
									onChange={(e) => {
										setFirstName(e.target.value);
										setError("");
									}}
									className="pl-10"
									disabled={isSubmitting}
									autoFocus
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="lastName">Last Name</Label>
							<div className="relative">
								<User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									id="lastName"
									type="text"
									placeholder="Doe"
									value={lastName}
									onChange={(e) => {
										setLastName(e.target.value);
										setError("");
									}}
									className="pl-10"
									disabled={isSubmitting}
								/>
							</div>
						</div>
					</div>

					{/* Email Field */}
					<div className="space-y-2">
						<Label htmlFor="email">Email Address</Label>
						<div className="relative">
							<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="email"
								type="email"
								placeholder="john.doe@email.com"
								value={email}
								onChange={(e) => {
									setEmail(normalizeEmailInput(e.target.value));
									setError("");
								}}
								onPaste={(event) => {
									const pasted = event.clipboardData?.getData("text") ?? "";
									setEmail(sanitizePastedEmail(pasted));
									setError("");
								}}
								className="pl-10"
								disabled={isSubmitting}
							/>
						</div>
					</div>

					{emailSuggestion && emailSuggestion !== normalizedEmail && (
						<p className="text-xs text-muted-foreground">
							Did you mean "
							<button
								type="button"
								onClick={() => {
									setEmail(emailSuggestion);
									setError("");
								}}
								className="text-primary underline"
							>
								{emailSuggestion}
							</button>
							? You can tap it to correct quickly, or continue as entered.
						</p>
					)}
					{canUseRecentProfile && (
						<p className="text-xs text-muted-foreground">
							Use recent details:{" "}
							<button
								type="button"
								onClick={() => {
									if (recentProfile) {
										setFirstName(recentProfile.firstName);
										setLastName(recentProfile.lastName);
										setEmail(recentProfile.email);
									}
									setError("");
								}}
								className="text-primary underline"
							>
								{recentProfile?.firstName} {recentProfile?.lastName} (
								{normalizedRecentEmail})
							</button>
						</p>
					)}
					{!canUseRecentProfile && hasRecentEmail && (
						<p className="text-xs text-muted-foreground">
							Recent email used:{" "}
							<button
								type="button"
								onClick={() => {
									setEmail(normalizedRecentEmail);
									setError("");
								}}
								className="text-primary underline"
							>
								{normalizedRecentEmail}
							</button>
						</p>
					)}

					{/* GDPR Consent */}
					<div className="space-y-2">
						<div className="flex items-start space-x-2">
							<input
								id="consent"
								type="checkbox"
								checked={consent}
								onChange={(e) => {
									setConsent(e.target.checked);
									setError("");
								}}
								className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
								disabled={isSubmitting}
							/>
							<Label
								htmlFor="consent"
								className="text-xs leading-relaxed cursor-pointer"
							>
								I agree to the collection and processing of my personal
								information for event recommendations and updates.
							</Label>
						</div>
						<button
							type="button"
							onClick={() => {
								window.open("./privacy", "_blank");
							}}
							className="text-xs text-primary underline hover:no-underline ml-6"
						>
							Read our Privacy Policy
						</button>
					</div>

					{error && <p className="text-sm text-destructive">{error}</p>}
					{isOffline && (
						<p className="text-xs text-amber-700 dark:text-amber-300">
							You are offline right now. Email verification needs a connection.
						</p>
					)}

					<div className="flex flex-col gap-2">
						<Button
							type="submit"
							className="w-full"
							disabled={isSubmitting || !consent || isOffline}
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
