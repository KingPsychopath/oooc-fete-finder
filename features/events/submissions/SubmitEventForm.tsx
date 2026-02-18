"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

type FormState = {
	eventName: string;
	date: string;
	startTime: string;
	location: string;
	hostEmail: string;
	proofLink: string;
	endTime: string;
	genre: string;
	price: string;
	age: string;
	indoorOutdoor: string;
	notes: string;
	arrondissement: string;
	honeypot: string;
};

const EMPTY_FORM: FormState = {
	eventName: "",
	date: "",
	startTime: "",
	location: "",
	hostEmail: "",
	proofLink: "",
	endTime: "",
	genre: "",
	price: "",
	age: "",
	indoorOutdoor: "",
	notes: "",
	arrondissement: "",
	honeypot: "",
};

const isValidUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
};

export function SubmitEventForm({
	submissionsEnabled = true,
}: {
	submissionsEnabled?: boolean;
}) {
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [showOptional, setShowOptional] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [formStartedAt, setFormStartedAt] = useState(() =>
		new Date().toISOString(),
	);
	const isFormDisabled = !submissionsEnabled || isSubmitting;

	const formPayload = useMemo(
		() => ({
			...form,
			formStartedAt,
		}),
		[form, formStartedAt],
	);

	const updateField = (field: keyof FormState, value: string) => {
		setForm((current) => ({
			...current,
			[field]: value,
		}));
	};

	const validate = (): string | null => {
		if (!form.eventName.trim()) return "Event name is required.";
		if (!form.date.trim()) return "Date is required.";
		if (!form.startTime.trim()) return "Start time is required.";
		if (!form.location.trim()) return "Location is required.";
		if (!form.hostEmail.trim()) return "Host email is required.";
		if (!form.proofLink.trim()) return "Proof link is required.";
		if (!form.hostEmail.includes("@")) return "Enter a valid email address.";
		if (!isValidUrl(form.proofLink.trim())) {
			return "Proof link must be a valid URL.";
		}
		return null;
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage("");
		setSuccessMessage("");

		if (!submissionsEnabled) {
			setErrorMessage("Event submissions are currently closed.");
			return;
		}

		const validationError = validate();
		if (validationError) {
			setErrorMessage(validationError);
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch(`${basePath}/api/event-submissions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formPayload),
				signal: AbortSignal.timeout(12000),
			});
			const payload = (await response.json()) as {
				success: boolean;
				message?: string;
				error?: string;
			};

			if (!response.ok || !payload.success) {
				if (response.status === 429) {
					const retryAfterSeconds = response.headers.get("retry-after") || "60";
					setErrorMessage(
						`Too many submissions right now. Please try again in about ${retryAfterSeconds} seconds.`,
					);
					return;
				}
				setErrorMessage(payload.error || "Failed to submit event.");
				return;
			}

			setSuccessMessage(
				payload.message ||
					"Thanks, your event submission has been received for review.",
			);
			setIsSubmitted(true);
			setForm(EMPTY_FORM);
			setFormStartedAt(new Date().toISOString());
		} catch (error) {
			if (
				error instanceof Error &&
				(error.name === "TimeoutError" || error.name === "AbortError")
			) {
				setErrorMessage("Submission timed out. Please try again.");
				return;
			}
			setErrorMessage("Submission failed. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm sm:p-6">
			{!submissionsEnabled && (
				<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
					Event submissions are currently closed. Please check back later.
				</div>
			)}
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="eventName">Event Name</Label>
						<Input
							id="eventName"
							value={form.eventName}
							onChange={(event) => updateField("eventName", event.target.value)}
							placeholder="Name of your event"
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="date">Date</Label>
						<Input
							id="date"
							type="date"
							value={form.date}
							onChange={(event) => updateField("date", event.target.value)}
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="startTime">Start Time</Label>
						<Input
							id="startTime"
							type="time"
							value={form.startTime}
							onChange={(event) => updateField("startTime", event.target.value)}
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="location">Location</Label>
						<Input
							id="location"
							value={form.location}
							onChange={(event) => updateField("location", event.target.value)}
							placeholder="Venue name or address"
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="hostEmail">Host Email</Label>
						<Input
							id="hostEmail"
							type="email"
							value={form.hostEmail}
							onChange={(event) => updateField("hostEmail", event.target.value)}
							placeholder="you@example.com"
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="proofLink">Proof Link</Label>
						<Input
							id="proofLink"
							type="url"
							value={form.proofLink}
							onChange={(event) => updateField("proofLink", event.target.value)}
							placeholder="Ticket, Instagram, or official event link"
							required
							disabled={isFormDisabled}
						/>
					</div>
				</div>

				<div className="rounded-md border bg-background/60 p-3">
					<button
						type="button"
						onClick={() => setShowOptional((value) => !value)}
						className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
						disabled={isFormDisabled}
					>
						{showOptional ? "Hide optional details" : "Add optional details"}
					</button>
					{showOptional && (
						<div className="mt-3 grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="endTime">End Time</Label>
								<Input
									id="endTime"
									type="time"
									value={form.endTime}
									onChange={(event) => updateField("endTime", event.target.value)}
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="genre">Genre</Label>
								<Input
									id="genre"
									value={form.genre}
									onChange={(event) => updateField("genre", event.target.value)}
									placeholder="Afrobeats, Dancehall, House"
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="price">Price</Label>
								<Input
									id="price"
									value={form.price}
									onChange={(event) => updateField("price", event.target.value)}
									placeholder="Free, EUR 15, etc."
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="age">Age</Label>
								<Input
									id="age"
									value={form.age}
									onChange={(event) => updateField("age", event.target.value)}
									placeholder="18+, 21+, All ages"
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="indoorOutdoor">Indoor/Outdoor</Label>
								<select
									id="indoorOutdoor"
									value={form.indoorOutdoor}
									onChange={(event) =>
										updateField("indoorOutdoor", event.target.value)
									}
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									disabled={isFormDisabled}
								>
									<option value="">Select</option>
									<option value="Indoor">Indoor</option>
									<option value="Outdoor">Outdoor</option>
									<option value="Indoor/Outdoor">Indoor/Outdoor</option>
								</select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="arrondissement">Arrondissement</Label>
								<Input
									id="arrondissement"
									value={form.arrondissement}
									onChange={(event) =>
										updateField("arrondissement", event.target.value)
									}
									placeholder="1-20 or unknown"
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2 md:col-span-2">
								<Label htmlFor="notes">Notes</Label>
								<Textarea
									id="notes"
									value={form.notes}
									onChange={(event) => updateField("notes", event.target.value)}
									rows={4}
									placeholder="Add context that helps us review your event"
									disabled={isFormDisabled}
								/>
							</div>
						</div>
					)}
				</div>

				<div className="sr-only" aria-hidden="true">
					<label htmlFor="website">Website</label>
					<input
						id="website"
						tabIndex={-1}
						autoComplete="off"
						value={form.honeypot}
						onChange={(event) => updateField("honeypot", event.target.value)}
						disabled={isFormDisabled}
					/>
				</div>

				{successMessage && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
						{successMessage}
					</div>
				)}
				{errorMessage && (
					<div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
						{errorMessage}
					</div>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" disabled={isFormDisabled}>
						{isSubmitting ? "Submitting..." : "Submit Event"}
					</Button>
					{isSubmitted && (
						<p className="text-xs text-muted-foreground">
							We will review your submission and may contact you for confirmation.
						</p>
					)}
				</div>
			</form>
		</div>
	);
}
