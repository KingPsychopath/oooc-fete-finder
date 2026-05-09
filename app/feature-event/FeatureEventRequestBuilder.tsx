"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clipboard,
	LineChart,
	Mail,
	Megaphone,
	Minus,
	Plus,
	Send,
	ShoppingBag,
	Star,
} from "lucide-react";
import { useState } from "react";

export interface PromotionPackage {
	id: string;
	name: string;
	price: number;
	priceLabel: string;
	description: string;
	includes: string[];
	badge?: string;
	tier: "spotlight" | "promoted";
}

export interface PromotionAddOn {
	id: string;
	name: string;
	price: number;
	priceLabel: string;
	description: string;
	reachHint?: string;
	includedWith?: PromotionPackage["tier"][];
}

interface RequestBuilderProps {
	packages: PromotionPackage[];
	addOns: PromotionAddOn[];
	contactEmail: string;
}

interface RequestDetails {
	eventName: string;
	eventDate: string;
	eventUrl: string;
	contactName: string;
	contactEmail: string;
	notes: string;
}

const initialDetails: RequestDetails = {
	eventName: "",
	eventDate: "",
	eventUrl: "",
	contactName: "",
	contactEmail: "",
	notes: "",
};

function formatPrice(value: number) {
	return new Intl.NumberFormat("en-GB", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	}).format(value);
}

function buildEmailBody({
	selectedPackage,
	selectedAddOns,
	details,
	total,
}: {
	selectedPackage: PromotionPackage | undefined;
	selectedAddOns: PromotionAddOn[];
	details: RequestDetails;
	total: number;
}) {
	const addOnLines =
		selectedAddOns.length > 0
			? selectedAddOns.map((addOn) => `- ${addOn.name} (${addOn.priceLabel})`)
			: ["- No paid add-ons selected"];

	return [
		"Hi OOOC team,",
		"",
		"I'd like to request promotion for this event:",
		"",
		"Event:",
		`- Name: ${details.eventName || "[event name]"}`,
		`- Date/time: ${details.eventDate || "[event date/time]"}`,
		`- Event link: ${details.eventUrl || "[event link]"}`,
		"",
		"Promotion package:",
		selectedPackage
			? `- ${selectedPackage.name} (${selectedPackage.priceLabel})`
			: "- [package not selected]",
		"",
		"Add-ons:",
		...addOnLines,
		"",
		`Estimated total: ${formatPrice(total)}`,
		"",
		"Notes:",
		details.notes || "[anything we should know]",
		"",
		"Contact:",
		`- Name: ${details.contactName || "[your name]"}`,
		`- Email: ${details.contactEmail || "[your email]"}`,
		"",
		"Thanks,",
	];
}

export function FeatureEventRequestBuilder({
	packages,
	addOns,
	contactEmail,
}: RequestBuilderProps) {
	const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id);
	const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
	const [details, setDetails] = useState<RequestDetails>(initialDetails);
	const [hasCopied, setHasCopied] = useState(false);
	const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

	const selectedPackage = packages.find(
		(pkg) => pkg.id === selectedPackageId,
	);
	const includedAddOnIds = new Set(
		addOns
			.filter(
				(addOn) =>
					selectedPackage &&
					addOn.includedWith?.includes(selectedPackage.tier),
			)
			.map((addOn) => addOn.id),
	);
	const selectedAddOns = addOns.filter(
		(addOn) =>
			selectedAddOnIds.includes(addOn.id) && !includedAddOnIds.has(addOn.id),
	);
	const total =
		(selectedPackage?.price ?? 0) +
		selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
	const emailBody = buildEmailBody({
		selectedPackage,
		selectedAddOns,
		details,
		total,
	});
	const subject = selectedPackage
		? `OOOC Fete promotion request - ${selectedPackage.name}`
		: "OOOC Fete promotion request";
	const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent(
		subject,
	)}&body=${encodeURIComponent(emailBody.join("\n"))}`;

	function handleDetailChange(field: keyof RequestDetails, value: string) {
		setDetails((current) => ({ ...current, [field]: value }));
	}

	function handleToggleAddOn(addOnId: string) {
		setSelectedAddOnIds((current) =>
			current.includes(addOnId)
				? current.filter((id) => id !== addOnId)
				: [...current, addOnId],
		);
	}

	async function handleCopyRequest() {
		await navigator.clipboard.writeText(emailBody.join("\n"));
		setHasCopied(true);
		window.setTimeout(() => setHasCopied(false), 1800);
	}

	return (
		<section
			className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
			aria-label="Promotion request builder"
		>
			<div className="space-y-8">
				<section aria-labelledby="promotion-packages-heading">
					<div className="mb-4">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Core offers
						</p>
						<h2
							id="promotion-packages-heading"
							className="mt-1 text-2xl font-light text-foreground"
						>
							Choose a promotion package
						</h2>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							Pick a visibility level. We will confirm fit, timing, and payment
							before anything goes live.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						{packages.map((pkg) => {
							const isSelected = selectedPackageId === pkg.id;
							const isPromoted = pkg.tier === "promoted";

							return (
								<button
									key={pkg.id}
									type="button"
									data-testid={`promotion-package-${pkg.id}`}
									onClick={() => setSelectedPackageId(pkg.id)}
									className={cn(
										"flex h-full flex-col rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6",
										isSelected
											? "border-foreground bg-card shadow-[0_12px_34px_rgba(18,14,10,0.16)]"
											: pkg.tier === "spotlight"
												? "border-amber-700/30 bg-amber-50/30 hover:border-amber-900/50"
												: "border-border/80 bg-card hover:border-foreground/40",
										isPromoted && "md:col-span-2",
									)}
									aria-pressed={isSelected}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="flex items-start gap-2 text-lg font-medium leading-snug text-foreground">
												<Star className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
												{pkg.name}
											</p>
											<p className="mt-2 text-2xl font-medium text-foreground">
												{pkg.priceLabel}
											</p>
										</div>
										{isSelected ? (
											<Badge className="shrink-0 rounded-full bg-foreground text-background">
												Selected
											</Badge>
										) : null}
									</div>
									<p className="mt-3 text-sm text-muted-foreground">
										{pkg.description}
									</p>
									{pkg.badge ? (
										<Badge
											variant="outline"
											className="mt-3 max-w-full whitespace-normal rounded-full px-3 py-1 text-left text-[10px] uppercase leading-snug tracking-[0.08em]"
										>
											{pkg.badge}
										</Badge>
									) : null}
									<ul
										className={cn(
											"mt-5 space-y-2 text-sm text-muted-foreground",
											isPromoted && "md:grid md:grid-cols-3 md:gap-3 md:space-y-0",
										)}
									>
										{pkg.includes.map((line) => (
											<li key={line} className="flex items-start gap-2">
												<CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground/70" />
												<span>{line}</span>
											</li>
										))}
									</ul>
								</button>
							);
						})}
					</div>
				</section>

				<section aria-labelledby="promotion-add-ons-heading">
					<div className="mb-4">
						<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
							Add-ons
						</p>
						<h2
							id="promotion-add-ons-heading"
							className="mt-1 flex items-center gap-2 text-2xl font-light text-foreground"
						>
							<Megaphone className="h-5 w-5 text-muted-foreground" />
							Add extra reach
						</h2>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							Add-ons are attached to the promotion package above. Spotlight
							already includes WhatsApp.
						</p>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						{addOns.map((addOn) => {
							const isIncluded = includedAddOnIds.has(addOn.id);
							const isSelected =
								isIncluded || selectedAddOnIds.includes(addOn.id);

							return (
								<button
									key={addOn.id}
									type="button"
									data-testid={`promotion-addon-${addOn.id}`}
									onClick={() => {
										if (!isIncluded) {
											handleToggleAddOn(addOn.id);
										}
									}}
									className={cn(
										"rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
										isSelected
											? "border-foreground bg-card shadow-[0_10px_24px_rgba(18,14,10,0.12)]"
											: "border-border/80 bg-card hover:border-foreground/40",
										isIncluded && "cursor-default",
									)}
									aria-pressed={isSelected}
								>
									<div className="flex items-start justify-between gap-3">
										<div>
											<p className="font-medium text-foreground">{addOn.name}</p>
											<p className="mt-1 text-sm text-muted-foreground">
												{addOn.description}
											</p>
											{addOn.reachHint ? (
												<p className="mt-1 text-xs text-muted-foreground/90">
													{addOn.reachHint}
												</p>
											) : null}
										</div>
										<Badge variant="outline" className="shrink-0 rounded-full">
											{isIncluded ? "Included" : addOn.priceLabel}
										</Badge>
									</div>
									<span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground">
										{isSelected ? (
											<Minus className="h-4 w-4" />
										) : (
											<Plus className="h-4 w-4" />
										)}
										{isIncluded
											? "Included with Spotlight"
											: isSelected
												? "Remove add-on"
												: "Add to request"}
									</span>
								</button>
							);
						})}
					</div>
				</section>

				<section
					className="rounded-2xl border border-border/80 bg-card p-5"
					aria-labelledby="request-details-heading"
				>
					<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						Request details
					</p>
					<h2
						id="request-details-heading"
						className="mt-1 text-2xl font-light text-foreground"
					>
						Add event details
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Optional but helpful. You can still send the request and fill in any
						blanks by email.
					</p>
					<div className="mt-5 grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="event-name">Event name</Label>
							<Input
								id="event-name"
								value={details.eventName}
								onChange={(event) =>
									handleDetailChange("eventName", event.target.value)
								}
								placeholder="e.g. Rooftop Fete Session"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="event-date">Event date/time</Label>
							<Input
								id="event-date"
								value={details.eventDate}
								onChange={(event) =>
									handleDetailChange("eventDate", event.target.value)
								}
								placeholder="e.g. 21 June, 8pm"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="event-url">Event link</Label>
							<Input
								id="event-url"
								type="url"
								value={details.eventUrl}
								onChange={(event) =>
									handleDetailChange("eventUrl", event.target.value)
								}
								placeholder="https://..."
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="contact-name">Your name</Label>
							<Input
								id="contact-name"
								value={details.contactName}
								onChange={(event) =>
									handleDetailChange("contactName", event.target.value)
								}
								placeholder="Name / venue / organiser"
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="contact-email">Your email</Label>
							<Input
								id="contact-email"
								inputMode="email"
								value={details.contactEmail}
								onChange={(event) =>
									handleDetailChange("contactEmail", event.target.value)
								}
								placeholder="you@example.com"
							/>
						</div>
						<div className="space-y-2 md:col-span-2">
							<Label htmlFor="request-notes">Notes</Label>
							<Textarea
								id="request-notes"
								value={details.notes}
								onChange={(event) =>
									handleDetailChange("notes", event.target.value)
								}
								placeholder="Preferred activation window, target audience, links, anything useful."
								className="min-h-28"
							/>
						</div>
					</div>
				</section>
			</div>

			<aside className="xl:sticky xl:top-24" aria-label="Promotion request summary">
				<div className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-[0_14px_34px_rgba(18,14,10,0.16)] backdrop-blur">
					<p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
						<ShoppingBag className="h-4 w-4" />
						Request summary
					</p>
					<div className="mt-4 space-y-3 text-sm">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="font-medium text-foreground">
									{selectedPackage?.name ?? "Choose a package"}
								</p>
								<p className="text-xs text-muted-foreground">
									Core promotion package
								</p>
							</div>
							<p className="shrink-0 font-medium text-foreground">
								{selectedPackage ? formatPrice(selectedPackage.price) : "-"}
							</p>
						</div>
						{addOns.map((addOn) => {
							const isIncluded = includedAddOnIds.has(addOn.id);
							const isSelected = selectedAddOns.some(
								(selectedAddOn) => selectedAddOn.id === addOn.id,
							);

							if (!isIncluded && !isSelected) {
								return null;
							}

							return (
								<div
									key={addOn.id}
									className="flex items-start justify-between gap-4"
								>
									<div>
										<p className="font-medium text-foreground">{addOn.name}</p>
										<p className="text-xs text-muted-foreground">
											{isIncluded
												? `${formatPrice(addOn.price)} value included`
												: "Paid add-on"}
										</p>
									</div>
									<p className="shrink-0 font-medium text-foreground">
										{isIncluded ? "Included" : formatPrice(addOn.price)}
									</p>
								</div>
							);
						})}
					</div>
					<div className="mt-5 border-t border-border pt-4">
						<div className="flex items-center justify-between gap-4">
							<p className="text-sm font-medium text-foreground">
								Estimated total
							</p>
							<p className="text-2xl font-medium text-foreground">
								{formatPrice(total)}
							</p>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							No obligation today. We confirm fit, timing, and payment details
							by email.
						</p>
					</div>
					<div className="mt-4 rounded-xl border border-border/70 bg-background/65 p-3 text-sm">
						<p className="flex items-center gap-2 font-medium text-foreground">
							<LineChart className="h-4 w-4" />
							Includes post-promotion reporting
						</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							After your campaign, we send a private performance link with
							outbound clicks, saves, and placement activity where available.
						</p>
					</div>
					<div className="mt-5 grid gap-2">
						<a
							data-testid="promotion-request-mailto"
							href={mailtoHref}
							className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-foreground px-4 text-sm font-medium text-background transition-all hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						>
							<Send className="h-4 w-4" />
							Request promotion
						</a>
						<Button
							type="button"
							variant="outline"
							className="h-10 rounded-full"
							onClick={handleCopyRequest}
						>
							<Clipboard className="h-4 w-4" />
							{hasCopied ? "Copied request" : "Copy request"}
						</Button>
					</div>
					<p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
						<Mail className="h-4 w-4" />
						Sends to {contactEmail}
					</p>
				</div>
			</aside>

			{isMobileSummaryOpen ? (
				<div
					id="promotion-mobile-summary"
					data-testid="promotion-mobile-summary-drawer"
					className="fixed inset-x-0 z-40 px-3 lg:hidden"
					style={{
						bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)",
					}}
				>
					<div className="mx-auto max-w-md rounded-2xl border border-border/80 bg-card/98 p-4 shadow-[0_18px_44px_rgba(18,14,10,0.24)] backdrop-blur">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
									Request summary
								</p>
								<p className="mt-1 text-lg font-medium text-foreground">
									{formatPrice(total)}
								</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8 rounded-full"
								onClick={() => setIsMobileSummaryOpen(false)}
								aria-label="Close request summary"
							>
								<ChevronDown className="h-4 w-4" />
							</Button>
						</div>
						<div className="mt-3 space-y-2 text-sm">
							<div className="flex items-start justify-between gap-3">
								<p className="font-medium text-foreground">
									{selectedPackage?.name ?? "Choose a package"}
								</p>
								<p className="shrink-0 text-foreground">
									{selectedPackage ? formatPrice(selectedPackage.price) : "-"}
								</p>
							</div>
							{addOns.map((addOn) => {
								const isIncluded = includedAddOnIds.has(addOn.id);
								const isSelected = selectedAddOns.some(
									(selectedAddOn) => selectedAddOn.id === addOn.id,
								);

								if (!isIncluded && !isSelected) {
									return null;
								}

								return (
									<div
										key={addOn.id}
										className="flex items-start justify-between gap-3 text-muted-foreground"
									>
										<p>{addOn.name}</p>
										<p className="shrink-0">
											{isIncluded
												? `${formatPrice(addOn.price)} value`
												: formatPrice(addOn.price)}
										</p>
									</div>
								);
							})}
						</div>
						<div className="mt-3 rounded-xl border border-border/70 bg-background/65 p-3">
							<p className="flex items-center gap-2 text-sm font-medium text-foreground">
								<LineChart className="h-4 w-4" />
								Post-promotion reporting included
							</p>
							<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
								Private performance link with clicks, saves, and placement
								activity where available.
							</p>
						</div>
						<div className="mt-3 grid grid-cols-2 gap-2">
							<a
								href={mailtoHref}
								className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-foreground px-3 text-sm font-medium text-background transition-all hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								Request
							</a>
							<Button
								type="button"
								variant="outline"
								className="h-10 rounded-full"
								onClick={handleCopyRequest}
							>
								{hasCopied ? "Copied" : "Copy"}
							</Button>
						</div>
					</div>
				</div>
			) : null}

			<div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 p-3 backdrop-blur lg:hidden">
				<div className="mx-auto flex max-w-6xl items-center gap-3">
					<button
						type="button"
						className="min-w-0 flex-1 text-left"
						onClick={() => setIsMobileSummaryOpen((current) => !current)}
						aria-expanded={isMobileSummaryOpen}
						aria-controls="promotion-mobile-summary"
					>
						<p className="truncate text-sm font-medium text-foreground">
							{selectedPackage?.name ?? "Promotion request"}
						</p>
						<p className="flex items-center gap-1 text-xs text-muted-foreground">
							{formatPrice(total)} estimated
							{isMobileSummaryOpen ? (
								<ChevronDown className="h-3.5 w-3.5" />
							) : (
								<ChevronUp className="h-3.5 w-3.5" />
							)}
						</p>
					</button>
					<a
						data-testid="promotion-request-mailto-mobile"
						href={mailtoHref}
						className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-foreground px-4 text-sm font-medium text-background transition-all hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						Request
					</a>
				</div>
			</div>
		</section>
	);
}
