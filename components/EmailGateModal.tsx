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
import { Mail, Lock, User } from "lucide-react";
import { authenticateUser } from "@/app/actions";

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
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [consent, setConsent] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const validateEmail = (email: string) => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const validateName = (name: string) => {
		return name.trim().length >= 2;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validation
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
			// Use server action with updated data
			const formData = new FormData();
			formData.append("firstName", firstName.trim());
			formData.append("lastName", lastName.trim());
			formData.append("email", email.trim());
			formData.append("consent", "true");

			const result = await authenticateUser(formData);

			if (result.success) {
				onEmailSubmit(email);
			} else {
				setError(result.error || "Something went wrong. Please try again.");
			}
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
									setEmail(e.target.value);
									setError("");
								}}
								className="pl-10"
								disabled={isSubmitting}
							/>
						</div>
					</div>

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
								className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
								// Use relative navigation which works with any base path
								window.open("./privacy", "_blank");
							}}
							className="text-xs text-primary underline hover:no-underline ml-6"
						>
							Read our Privacy Policy
						</button>
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
