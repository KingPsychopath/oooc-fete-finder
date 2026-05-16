import { useOnlineStatus } from "@/components/online-status-gate";
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
	validateName,
} from "@/features/auth/email-gate-utils";
import {
	getClientContext,
	getOrCreateEngagementSessionId,
} from "@/features/events/engagement/client-tracking";
import { Lock, Mail, User } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

type EmailGateModalProps = {
	isOpen: boolean;
	onEmailSubmit: (email: string) => Promise<boolean>;
	onClose?: () => void;
};

type AuthLookupResult = {
	email: string;
	requiresName: boolean;
	requiresConsent: boolean;
};

type LookupState = "idle" | "checking" | "ready";
type AuthFlowStep = "email" | "details";

const LAST_AUTH_PROFILE_KEY = "oooc_last_auth_profile_v1";
const DEPRECATED_LAST_AUTH_EMAIL_KEY = "oooc_last_auth_email_v1";

const EMAIL_TEXT = {
	emailCheckFailed:
		"We could not auto-check this email yet. Please fill the form to continue.",
};

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
	const [lookupState, setLookupState] = useState<LookupState>("idle");
	const [lookupResult, setLookupResult] = useState<AuthLookupResult | null>(
		null,
	);
	const [flowStep, setFlowStep] = useState<AuthFlowStep>("email");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [lookupError, setLookupError] = useState("");
	const isOnline = useOnlineStatus();
	const isOffline = !isOnline;
	const [recentProfile, setRecentProfile] = useState<StoredAuthProfile | null>(
		null,
	);
	const lookupAbortRef = useRef<AbortController | null>(null);
	const lookedUpEmailRef = useRef("");

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.removeItem(DEPRECATED_LAST_AUTH_EMAIL_KEY);
		const storedProfileRaw = window.localStorage.getItem(LAST_AUTH_PROFILE_KEY);
		if (!storedProfileRaw) {
			return;
		}
		try {
			const parsed = sanitizeRecentProfile(
				JSON.parse(storedProfileRaw) as unknown,
			);
			if (parsed) {
				setRecentProfile(parsed);
				setEmail(parsed.email);
			}
		} catch {}
	}, []);

	const clearLookupState = useCallback(() => {
		setLookupState("idle");
		setLookupResult(null);
		lookedUpEmailRef.current = "";
	}, []);

	const clearForNewEmail = useCallback(
		(nextEmail: string) => {
			setEmail(nextEmail);
			setError("");
			setLookupError("");
			setFirstName("");
			setLastName("");
			setConsent(false);
			setFlowStep("email");
			clearLookupState();
		},
		[clearLookupState],
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		clearLookupState();
		setFirstName("");
		setLastName("");
		setConsent(false);
		setFlowStep("email");
		setError("");
		setLookupError("");
	}, [isOpen, clearLookupState]);

	const applyLookupResult = useCallback((result: AuthLookupResult | null) => {
		if (!result) {
			setLookupState("idle");
			setLookupResult(null);
			return;
		}

		setLookupResult(result);
		setLookupState("ready");
		setLookupError("");
		lookedUpEmailRef.current = result.email;

		if (result.requiresName) {
			setFirstName((current) => (validateName(current) ? current : ""));
			setLastName((current) => (validateName(current) ? current : ""));
		} else {
			setFirstName("");
			setLastName("");
		}

		if (result.requiresConsent) {
			setConsent(false);
		} else {
			setConsent(true);
		}
	}, []);

	const runEmailLookup = useCallback(
		async (candidateEmail: string): Promise<AuthLookupResult | null> => {
			const normalizedEmail = normalizeEmailInput(candidateEmail).toLowerCase();
			if (!normalizedEmail || !validateEmail(normalizedEmail)) {
				clearLookupState();
				return null;
			}

			if (
				lookupState === "ready" &&
				lookedUpEmailRef.current === normalizedEmail &&
				lookupResult?.email === normalizedEmail
			) {
				return lookupResult;
			}

			if (lookupAbortRef.current) {
				lookupAbortRef.current.abort();
			}
			const controller = new AbortController();
			lookupAbortRef.current = controller;
			setLookupState("checking");
			setLookupError("");

			try {
				const response = await fetch(`${basePath}/api/auth/lookup`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email: normalizedEmail }),
					signal: controller.signal,
				});

				if (!response.ok) {
					const fallbackError =
						"Could not fetch account details right now. You can still continue.";
					setLookupError(fallbackError);
					applyLookupResult(null);
					return null;
				}

				const payload = (await response.json()) as {
					success: boolean;
					email: string;
					requiresName?: boolean;
					requiresConsent?: boolean;
					error?: string;
				};

				if (!payload.success) {
					setLookupError(payload.error || EMAIL_TEXT.emailCheckFailed);
					applyLookupResult(null);
					return null;
				}

				const result = {
					email: normalizeEmailInput(payload.email).toLowerCase(),
					requiresName: payload.requiresName !== false,
					requiresConsent: payload.requiresConsent !== false,
				};
				applyLookupResult(result);
				return result;
			} catch (lookupError) {
				if (
					lookupError instanceof DOMException &&
					lookupError.name === "AbortError"
				) {
					return null;
				}
				setLookupError(EMAIL_TEXT.emailCheckFailed);
				applyLookupResult(null);
				return null;
			}
		},
		[applyLookupResult, basePath, clearLookupState, lookupResult, lookupState],
	);

	useEffect(() => {
		return () => {
			if (lookupAbortRef.current) {
				lookupAbortRef.current.abort();
			}
		};
	}, []);

	const normalizedEmail = normalizeEmailInput(email).toLowerCase();
	const emailSuggestion = buildSuggestedEmail(email);
	const normalizedRecentEmail = recentProfile?.email ?? "";
	const hasRecentEmail =
		normalizedRecentEmail.length > 0 &&
		normalizedRecentEmail !== normalizedEmail &&
		validateEmail(normalizedRecentEmail);
	const hasStoredNameFromLookup =
		lookupState === "ready" && lookupResult?.requiresName === false;
	const hasStoredConsentFromLookup =
		lookupState === "ready" && lookupResult?.requiresConsent === false;
	const shouldCollectName = flowStep === "details" && !hasStoredNameFromLookup;
	const shouldCollectConsent =
		flowStep === "details" && !hasStoredConsentFromLookup;
	const canUseRecentProfile =
		shouldCollectName &&
		recentProfile !== null &&
		!isSubmitting &&
		recentProfile.email === normalizedEmail &&
		recentProfile.firstName.length >= 2 &&
		recentProfile.lastName.length >= 2 &&
		(recentProfile.firstName !== firstName.trim() ||
			recentProfile.lastName !== lastName.trim());
	const isCheckingEmail = lookupState === "checking";
	const submitButtonText =
		flowStep === "email" ? "Continue" : "Continue to Events";

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const finalEmail = normalizedEmail;

		if (!finalEmail) {
			setError("Please enter your email address");
			return;
		}
		if (!validateEmail(finalEmail)) {
			setError("Please enter a valid email address");
			return;
		}

		if (isOffline) {
			setError("You are offline. Reconnect to verify your email.");
			return;
		}

		const lookupForSubmit = await runEmailLookup(finalEmail);
		const shouldRequireLookupName = lookupForSubmit?.requiresName !== false;
		const shouldRequireLookupConsent =
			lookupForSubmit?.requiresConsent !== false;

		if (flowStep === "email") {
			if (shouldRequireLookupName || shouldRequireLookupConsent) {
				setFlowStep("details");
				setError("");
				return;
			}
		}

		const resolvedFirstName = shouldRequireLookupName ? firstName.trim() : "";
		const resolvedLastName = shouldRequireLookupName ? lastName.trim() : "";
		const shouldRequireName = flowStep === "details" && shouldRequireLookupName;
		const shouldRequireConsent =
			flowStep === "details" && shouldRequireLookupConsent;

		if (shouldRequireName && !resolvedFirstName) {
			setError("Please enter your first name");
			return;
		}
		if (shouldRequireName && !validateName(resolvedFirstName)) {
			setError("First name must be at least 2 characters");
			return;
		}
		if (shouldRequireName && !resolvedLastName) {
			setError("Please enter your last name");
			return;
		}
		if (shouldRequireName && !validateName(resolvedLastName)) {
			setError("Last name must be at least 2 characters");
			return;
		}
		if (shouldRequireConsent && !consent) {
			setError("Please accept our privacy policy to continue");
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
					firstName: resolvedFirstName,
					lastName: resolvedLastName,
					email: finalEmail,
					consent: shouldRequireConsent ? consent : true,
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
					window.localStorage.removeItem(DEPRECATED_LAST_AUTH_EMAIL_KEY);
					if (
						validateName(resolvedFirstName) &&
						validateName(resolvedLastName)
					) {
						const nextProfile = {
							firstName: resolvedFirstName,
							lastName: resolvedLastName,
							email: finalEmail,
						};
						setRecentProfile(nextProfile);
						window.localStorage.setItem(
							LAST_AUTH_PROFILE_KEY,
							JSON.stringify(nextProfile),
						);
					}
				}

				const hasConfirmedSession = await onEmailSubmit(finalEmail);
				if (!hasConfirmedSession) {
					setError(
						"We verified your details, but we could not confirm your session yet. Tap Continue once more.",
					);
				}
			} else {
				setError(result.error || "Something went wrong. Please try again.");
			}
		} catch (submitError) {
			if (!isOnline) {
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

	const handleEmailFocusClearLookup = () => {
		setError("");
		setLookupError("");
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent
				className="z-[200] border-border/70 shadow-2xl sm:max-w-md [background:var(--card)]"
				style={{ animation: "none", opacity: 1 }}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Lock className="h-5 w-5" />
						Access Required
					</DialogTitle>
					<DialogDescription>
						To use filters and explore events, please provide your details. We
						will use this to improve our recommendations and keep you updated on
						future events.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
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
								onChange={(event) => {
									clearForNewEmail(normalizeEmailInput(event.target.value));
								}}
								onPaste={(event) => {
									const pasted = event.clipboardData?.getData("text") ?? "";
									clearForNewEmail(sanitizePastedEmail(pasted));
								}}
								onFocus={handleEmailFocusClearLookup}
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
									clearForNewEmail(emailSuggestion);
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
									if (!recentProfile) return;
									setFirstName(recentProfile.firstName);
									setLastName(recentProfile.lastName);
									setError("");
									setLookupError("");
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
									clearForNewEmail(normalizedRecentEmail);
								}}
								className="text-primary underline"
							>
								{normalizedRecentEmail}
							</button>
						</p>
					)}

					{flowStep === "details" ? (
						<>
							{hasStoredNameFromLookup && (
								<p className="text-sm text-muted-foreground">
									Your name is already on file for this email.
								</p>
							)}

							{shouldCollectName && (
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
												onChange={(event) => {
													setFirstName(event.target.value);
													setError("");
												}}
												className="pl-10"
												disabled={isSubmitting}
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
												onChange={(event) => {
													setLastName(event.target.value);
													setError("");
												}}
												className="pl-10"
												disabled={isSubmitting}
											/>
										</div>
									</div>
								</div>
							)}

							{shouldCollectConsent ? (
								<div className="space-y-2">
									<div className="flex items-start space-x-2">
										<input
											id="consent"
											type="checkbox"
											checked={consent}
											onChange={(event) => {
												setConsent(event.target.checked);
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
								</div>
							) : (
								<p className="rounded-md border border-border/50 bg-muted/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
									Privacy policy already accepted for this email.
								</p>
							)}

							<button
								type="button"
								onClick={() => {
									window.open("./privacy", "_blank");
								}}
								className="text-xs text-primary underline hover:no-underline"
							>
								Read our Privacy Policy
							</button>
						</>
					) : null}

					{error && <p className="text-sm text-destructive">{error}</p>}
					{lookupError && !error && (
						<p className="text-xs text-muted-foreground">{lookupError}</p>
					)}
					{isCheckingEmail && !error && !lookupError && (
						<p className="text-xs text-muted-foreground">Checking email...</p>
					)}
					{isOffline && (
						<p className="text-xs text-amber-700 dark:text-amber-300">
							You are offline right now. Email verification needs a connection.
						</p>
					)}

					<div className="flex flex-col gap-2">
						<Button
							type="submit"
							className="w-full"
							disabled={
								isSubmitting ||
								isOffline ||
								isCheckingEmail ||
								(flowStep === "details" &&
									shouldCollectName &&
									(!validateName(firstName.trim()) ||
										!validateName(lastName.trim()))) ||
								(flowStep === "details" && shouldCollectConsent && !consent) ||
								(flowStep === "email" && !validateEmail(normalizedEmail))
							}
						>
							{isSubmitting ? "Verifying..." : submitButtonText}
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
