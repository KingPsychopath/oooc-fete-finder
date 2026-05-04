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
import { OFFLINE_GRACE_WINDOW_MS } from "@/features/auth/offline-grace";
import { Lock, Mail, User } from "lucide-react";
import React, { useEffect, useState } from "react";

type EmailGateModalProps = {
	isOpen: boolean;
	onEmailSubmit: (email: string) => Promise<boolean>;
	onClose?: () => void;
};

const commonEmailDomains = [
	"gmail.com",
	"yahoo.com",
	"hotmail.com",
	"outlook.com",
	"icloud.com",
	"protonmail.com",
	"aol.com",
	"msn.com",
	"live.com",
	"googlemail.com",
	"mail.com",
	"zoho.com",
	"me.com",
];

const suggestableEmailTlds = new Set([
	"com",
	"con",
	"net",
	"org",
	"co.uk",
	"com.au",
	"io",
	"co",
	"ca",
	"de",
	"uk",
	"fr",
	"it",
	"es",
	"au",
	"nz",
	"in",
	"us",
	"at",
	"be",
]);

const LAST_AUTH_PROFILE_KEY = "oooc_last_auth_profile_v1";
const LAST_AUTH_EMAIL_KEY = "oooc_last_auth_email_v1";

type StoredAuthProfile = {
	firstName: string;
	lastName: string;
	email: string;
};

const sanitizeRecentProfile = (value: unknown): StoredAuthProfile | null => {
	if (!value || typeof value !== "object") return null;

	const profile = value as Partial<StoredAuthProfile>;
	const firstName = typeof profile.firstName === "string" ? profile.firstName.trim() : "";
	const lastName = typeof profile.lastName === "string" ? profile.lastName.trim() : "";
	const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
	if (!firstName || !lastName || !email) return null;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

	return { firstName, lastName, email };
};

const isLikelyTypoDomain = (domain: string): boolean => {
	const normalized = domain.toLowerCase();
	if (!normalized.includes(".") || normalized.length > 24) return false;

	const labels = normalized.split(".");
	if (labels.length > 3 || labels.some((label) => label.length === 0)) {
		return false;
	}

	const tldPair = labels.length >= 2 ? `${labels.at(-2)}.${labels.at(-1)}` : "";
	if (labels.length === 2 && suggestableEmailTlds.has(labels.at(-1) ?? "")) {
		return true;
	}

	if (
		(labels.length === 3 && suggestableEmailTlds.has(tldPair)) ||
		(labels.length === 3 &&
			suggestableEmailTlds.has(`${labels.at(-1) ?? ""}`) &&
			labels.at(-2) === "co")
	) {
		return true;
	}

	return false;
};

const calculateSuggestionConfidence = (
	domain: string,
	distance: number,
): boolean => {
	if (distance === 1) return true;
	if (distance > 2) return false;

	const hasDotty = domain.includes(".");
	const hasBusinessShape =
		domain.length >= 9 && domain.length <= 20 && hasDotty && domain.includes(".");
	return distance === 2 ? hasBusinessShape : false;
};

const validateEmail = (rawEmail: string) => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(rawEmail);
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
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [isOffline, setIsOffline] = useState(false);
	const [recentProfile, setRecentProfile] = useState<StoredAuthProfile | null>(null);

	const normalizeEmailInput = (value: string): string => {
		return value.replace(/\s*@\s*/g, "@").trim();
	};

	const calculateLevenshteinDistance = (left: string, right: string): number => {
		if (left.length === 0) return right.length;
		if (right.length === 0) return left.length;

		const matrix: number[][] = Array.from({ length: left.length + 1 }, () =>
			Array.from({ length: right.length + 1 }, () => 0),
		);

		for (let i = 0; i <= left.length; i += 1) {
			matrix[i][0] = i;
		}
		for (let j = 0; j <= right.length; j += 1) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= left.length; i += 1) {
			for (let j = 1; j <= right.length; j += 1) {
				const cost = left[i - 1] === right[j - 1] ? 0 : 1;
				matrix[i][j] = Math.min(
					matrix[i - 1][j] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j - 1] + cost,
				);
			}
		}

		return matrix[left.length][right.length];
	};

	const buildSuggestedEmail = (rawEmail: string): string | null => {
		const normalized = normalizeEmailInput(rawEmail).toLowerCase();
		const atIndex = normalized.lastIndexOf("@");
		if (atIndex <= 0) return null;

		const localPart = normalized.slice(0, atIndex);
		const domainPart = normalized.slice(atIndex + 1);
		if (!localPart || !domainPart || !domainPart.includes(".")) return null;
		if (!isLikelyTypoDomain(domainPart)) return null;

		let bestDomain = "";
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const domain of commonEmailDomains) {
			const distance = calculateLevenshteinDistance(domainPart, domain);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestDomain = domain;
			}
		}

		if (!calculateSuggestionConfidence(domainPart, bestDistance)) return null;
		return `${localPart}@${bestDomain}`;
	};

	const sanitizePastedEmail = (value: string): string => {
		const trimmed = value.trim();
		return normalizeEmailInput(
			trimmed
				.replace(/^[\s<([{"'`.,;:>)}]+/, "")
				.replace(/[\s<([{"'`.,;:>)}]+$/, ""),
		);
	};

	const formatGraceWindow = (): string => {
		const hours = Math.round(OFFLINE_GRACE_WINDOW_MS / (1000 * 60 * 60));
		if (hours >= 24) {
			const days = Math.round(hours / 24);
			return `${days} days`;
		}
		return `${hours} hours`;
	};

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
				const parsed = sanitizeRecentProfile(JSON.parse(storedProfileRaw) as unknown);
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
		((recentProfile.firstName !== firstName.trim()) ||
			(recentProfile.lastName !== lastName.trim()) ||
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
						We'll use this to improve our recommendations and keep you
						updated on future events.
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
									const pasted =
										event.clipboardData?.getData("text") ?? "";
									setEmail(sanitizePastedEmail(pasted));
									setError("");
								}}
								className="pl-10"
								disabled={isSubmitting}
							/>
						</div>
					</div>

					{emailSuggestion &&
						emailSuggestion !== normalizedEmail && (
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
							You are offline right now. Email verification needs a
							connection.
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						If connectivity drops, this browser keeps your sign-in hint for about{" "}
						{formatGraceWindow()} so you can get back in quickly.
						It applies per browser storage (same profile/tabs), not across
						separate app/browser profiles.
					</p>

					<div className="flex flex-col gap-2">
						<Button
							type="submit"
							className="w-full"
							disabled={isSubmitting || !consent || isOffline}
						>
							{isSubmitting ? "Verifying..." : "Continue to Events"}
						</Button>
						<p className="text-xs text-muted-foreground text-center">
							Your data is secure and will only be used as described in
							our privacy policy.
						</p>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};

export default EmailGateModal;
