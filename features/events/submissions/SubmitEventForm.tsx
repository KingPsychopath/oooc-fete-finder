"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeProofLink } from "@/features/events/submissions/proof-link";
import { useEffect, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const DRAFT_STORAGE_KEY = "oooc:fete-finder:submit-event:draft:v1";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

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

const buildReusableForm = (previous: FormState): FormState => ({
	...EMPTY_FORM,
	eventName: previous.eventName,
	location: previous.location,
	hostEmail: previous.hostEmail,
	genre: previous.genre,
	price: previous.price,
	age: previous.age,
	indoorOutdoor: previous.indoorOutdoor,
	arrondissement: previous.arrondissement,
});

const hasDraftContent = (form: FormState): boolean =>
	Object.entries(form).some(
		([field, value]) => field !== "honeypot" && value.trim().length > 0,
	);

const shouldShowOptionalDetails = (form: FormState): boolean =>
	Boolean(
		form.endTime ||
			form.genre ||
			form.price ||
			form.age ||
			form.indoorOutdoor ||
			form.notes ||
			form.arrondissement,
	);

const toStoredDraft = (form: FormState): FormState => ({
	...form,
	honeypot: "",
});

const toRestoredDraft = (candidate: unknown): FormState | null => {
	if (!candidate || typeof candidate !== "object") return null;
	const draft = candidate as Record<string, unknown>;
	return {
		eventName: typeof draft.eventName === "string" ? draft.eventName : "",
		date: typeof draft.date === "string" ? draft.date : "",
		startTime: typeof draft.startTime === "string" ? draft.startTime : "",
		location: typeof draft.location === "string" ? draft.location : "",
		hostEmail: typeof draft.hostEmail === "string" ? draft.hostEmail : "",
		proofLink: typeof draft.proofLink === "string" ? draft.proofLink : "",
		endTime: typeof draft.endTime === "string" ? draft.endTime : "",
		genre: typeof draft.genre === "string" ? draft.genre : "",
		price: typeof draft.price === "string" ? draft.price : "",
		age: typeof draft.age === "string" ? draft.age : "",
		indoorOutdoor:
			typeof draft.indoorOutdoor === "string" ? draft.indoorOutdoor : "",
		notes: typeof draft.notes === "string" ? draft.notes : "",
		arrondissement:
			typeof draft.arrondissement === "string" ? draft.arrondissement : "",
		honeypot: "",
	};
};

const readStoredDraft = (): FormState | null => {
	try {
		const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
		if (!rawDraft) return null;
		const parsed = JSON.parse(rawDraft) as {
			savedAt?: unknown;
			form?: Partial<FormState>;
		};
		if (typeof parsed.savedAt !== "number") return null;
		if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
			window.localStorage.removeItem(DRAFT_STORAGE_KEY);
			return null;
		}
		return toRestoredDraft(parsed.form);
	} catch {
		window.localStorage.removeItem(DRAFT_STORAGE_KEY);
		return null;
	}
};

const saveDraft = (form: FormState) => {
	try {
		if (!hasDraftContent(form)) {
			window.localStorage.removeItem(DRAFT_STORAGE_KEY);
			return;
		}
		window.localStorage.setItem(
			DRAFT_STORAGE_KEY,
			JSON.stringify({
				savedAt: Date.now(),
				form: toStoredDraft(form),
			}),
		);
	} catch {
		// Losing autosave should never block a real event submission.
	}
};

const clearDraft = () => {
	try {
		window.localStorage.removeItem(DRAFT_STORAGE_KEY);
	} catch {
		// Ignore storage failures; the in-page form state is still authoritative.
	}
};

export function SubmitEventForm({
	submissionsEnabled = true,
}: {
	submissionsEnabled?: boolean;
}) {
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [lastSubmittedForm, setLastSubmittedForm] = useState<FormState | null>(
		null,
	);
	const [showOptional, setShowOptional] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isReusingPrevious, setIsReusingPrevious] = useState(false);
	const [isDraftReady, setIsDraftReady] = useState(false);
	const [wasDraftRestored, setWasDraftRestored] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [formStartedAt, setFormStartedAt] = useState(() =>
		new Date().toISOString(),
	);
	const isFormDisabled = !submissionsEnabled || isSubmitting;

	useEffect(() => {
		const storedDraft = readStoredDraft();
		if (storedDraft && hasDraftContent(storedDraft)) {
			setForm(storedDraft);
			setShowOptional(shouldShowOptionalDetails(storedDraft));
			setWasDraftRestored(true);
		}
		setIsDraftReady(true);
	}, []);

	useEffect(() => {
		if (!isDraftReady || isSubmitted) return;
		saveDraft(form);
	}, [form, isDraftReady, isSubmitted]);

	const updateField = (field: keyof FormState, value: string) => {
		setForm((current) => ({
			...current,
			[field]: value,
		}));
	};

	const normalizeProofLinkField = () => {
		const normalized = normalizeProofLink(form.proofLink);
		if (normalized) {
			updateField("proofLink", normalized);
		}
	};

	const validate = (): string | null => {
		if (!form.eventName.trim()) return "Event name is required.";
		if (!form.date.trim()) return "Date is required.";
		if (!form.startTime.trim()) return "Start time is required.";
		if (!form.location.trim()) return "Location is required.";
		if (!form.hostEmail.trim()) return "Host email is required.";
		if (!form.proofLink.trim()) return "Proof link is required.";
		if (!form.hostEmail.includes("@")) return "Enter a valid email address.";
		if (!normalizeProofLink(form.proofLink)) {
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
		const normalizedProofLink = normalizeProofLink(form.proofLink);
		if (!normalizedProofLink) {
			setErrorMessage("Proof link must be a valid URL.");
			return;
		}
		const submittedForm = {
			...form,
			proofLink: normalizedProofLink,
		};

		setIsSubmitting(true);
		try {
			const response = await fetch(`${basePath}/api/event-submissions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...submittedForm,
					formStartedAt,
				}),
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
					"Your event was sent for review. Add another with reused details, or start fresh.",
			);
			setIsSubmitted(true);
			setIsReusingPrevious(false);
			setLastSubmittedForm(submittedForm);
			setForm(EMPTY_FORM);
			clearDraft();
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

	const focusField = (fieldId: string) => {
		window.requestAnimationFrame(() => {
			document.getElementById(fieldId)?.focus();
		});
	};

	const handleSubmitAnother = () => {
		if (!lastSubmittedForm) return;
		setForm(buildReusableForm(lastSubmittedForm));
		setShowOptional(
			Boolean(
				lastSubmittedForm.genre ||
					lastSubmittedForm.price ||
					lastSubmittedForm.age ||
					lastSubmittedForm.indoorOutdoor ||
					lastSubmittedForm.arrondissement,
			),
		);
		setIsSubmitted(false);
		setIsReusingPrevious(true);
		setWasDraftRestored(false);
		setErrorMessage("");
		setSuccessMessage("");
		setFormStartedAt(new Date().toISOString());
		focusField("date");
	};

	const handleStartFresh = () => {
		setForm(EMPTY_FORM);
		setShowOptional(false);
		setIsSubmitted(false);
		setIsReusingPrevious(false);
		setWasDraftRestored(false);
		setErrorMessage("");
		setSuccessMessage("");
		clearDraft();
		setFormStartedAt(new Date().toISOString());
		focusField("eventName");
	};

	const handleClearForm = () => {
		if (
			hasDraftContent(form) &&
			!window.confirm("Clear this draft and start again?")
		) {
			return;
		}
		handleStartFresh();
	};

	return (
		<div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm sm:p-6">
			{!submissionsEnabled && (
				<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
					Event submissions are currently closed. Please check back later.
				</div>
			)}
			<form onSubmit={handleSubmit} className="space-y-4">
				{wasDraftRestored && !isSubmitted && (
					<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
						We restored your unsent draft from this browser.
					</div>
				)}
				{isReusingPrevious && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
						Reusing details from your last submission. Update the event name,
						venue, genre, or price if they changed. Add a new date, time, and
						link for this event.
					</div>
				)}
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="eventName">Event Name</Label>
						<Input
							id="eventName"
							list="previous-event-names"
							value={form.eventName}
							onChange={(event) => updateField("eventName", event.target.value)}
							placeholder="FDLM: Day Party, FDLM: After Party"
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
							list="previous-locations"
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
							type="text"
							value={form.proofLink}
							onChange={(event) => updateField("proofLink", event.target.value)}
							onBlur={normalizeProofLinkField}
							placeholder="Ticket, Instagram, or official event link (https:// optional)"
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
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
									onChange={(event) =>
										updateField("endTime", event.target.value)
									}
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="genre">Genre</Label>
								<Input
									id="genre"
									list="previous-genres"
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
									placeholder="Free, €15, €28 - €35.84"
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

				<datalist id="previous-event-names">
					{lastSubmittedForm?.eventName && (
						<option value={lastSubmittedForm.eventName} />
					)}
				</datalist>
				<datalist id="previous-locations">
					{lastSubmittedForm?.location && (
						<option value={lastSubmittedForm.location} />
					)}
				</datalist>
				<datalist id="previous-genres">
					{lastSubmittedForm?.genre && (
						<option value={lastSubmittedForm.genre} />
					)}
				</datalist>

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
					<div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
						<p>{successMessage}</p>
						{lastSubmittedForm && (
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									onClick={handleSubmitAnother}
									disabled={isFormDisabled}
								>
									Submit another date/event
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={handleStartFresh}
									disabled={isFormDisabled}
								>
									Start fresh
								</Button>
							</div>
						)}
					</div>
				)}
				{errorMessage && (
					<div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
						{errorMessage}
					</div>
				)}

				{!isSubmitted && (
					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" disabled={isFormDisabled}>
							{isSubmitting ? "Submitting..." : "Submit Event"}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={handleClearForm}
							disabled={isFormDisabled || !hasDraftContent(form)}
						>
							Clear form
						</Button>
					</div>
				)}
			</form>
		</div>
	);
}
