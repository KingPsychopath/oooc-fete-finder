import {
	formatDayWithDate,
	formatLocationAreaLong,
	formatPrice,
	type Event,
} from "@/features/events/types";
import Link from "next/link";

interface EventShareModalPreviewProps {
	event: Event;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const homePath = basePath && basePath !== "/" ? basePath : "/";

const formatTimeRange = (event: Event): string => {
	const hasStart = Boolean(event.time && event.time !== "TBC");
	const hasEnd = Boolean(event.endTime && event.endTime !== "TBC");
	if (hasStart && hasEnd) return `${event.time} - ${event.endTime}`;
	if (hasStart) return event.time || "TBC";
	return "TBC";
};

const formatPrimaryLinkLabel = (value: string): string => {
	if (!value || value === "#") return "Link coming soon";
	try {
		const parsed = new URL(value);
		return `View on ${parsed.hostname.replace("www.", "")}`;
	} catch {
		return "View event details";
	}
};

export function EventShareModalPreview({ event }: EventShareModalPreviewProps) {
	const primaryLink = event.links?.[0] || event.link;
	const dateLabel = event.date
		? formatDayWithDate(event.day, event.date)
		: "Date TBC";
	const priceLabel = formatPrice(event.price);
	const locationArea = formatLocationAreaLong(event.arrondissement);
	const venueTypeLabel =
		event.venueTypes.length > 0
			? event.venueTypes
					.map((venueType) =>
						venueType === "indoor" ? "Indoor" : "Outdoor",
					)
					.join(" & ")
			: event.indoor
				? "Indoor"
				: "Outdoor";

	return (
		<div
			data-event-share-preview
			className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-[4px]"
			style={{
				paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
				paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
				paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
				paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
			}}
		>
			<section className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] w-full max-w-[38rem] overflow-y-auto rounded-[22px] border border-border/80 bg-card/95 p-4 shadow-[0_36px_90px_-52px_rgba(0,0,0,0.9)] sm:max-h-[90vh] sm:rounded-[26px] sm:p-5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
							Out Of Office Collective
						</p>
						<h1 className="mt-1 break-words text-[clamp(1.25rem,3.5vw,1.9rem)] [font-family:var(--ooo-font-display)] font-light leading-tight text-foreground">
							{event.name}
						</h1>
					</div>
					<Link
						href={homePath}
						className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-lg leading-none text-foreground transition-colors hover:bg-accent"
						aria-label="Close event details"
					>
						x
					</Link>
				</div>

				{event.genre.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{event.genre.slice(0, 6).map((genre) => (
							<span
								key={genre}
								className="rounded-full border border-border/60 bg-background/75 px-2.5 py-1 text-xs font-medium text-foreground"
							>
								{genre}
							</span>
						))}
					</div>
				)}

				<div className="mt-6 grid gap-2 sm:grid-cols-2">
					<div className="rounded-xl border border-border/70 bg-background/60 p-3">
						<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							Date
						</p>
						<p className="mt-1 text-sm text-foreground">{dateLabel}</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-background/60 p-3">
						<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							Time
						</p>
						<p className="mt-1 text-sm text-foreground">
							{formatTimeRange(event)}
						</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-background/60 p-3">
						<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							Price
						</p>
						<p className="mt-1 text-sm text-foreground">{priceLabel}</p>
					</div>
					<div className="rounded-xl border border-border/70 bg-background/60 p-3">
						<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							Venue type
						</p>
						<p className="mt-1 text-sm text-foreground">{venueTypeLabel}</p>
					</div>
				</div>

				<div className="mt-2 rounded-xl border border-border/70 bg-background/60 p-3">
					<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
						{locationArea}
					</p>
					<p className="mt-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-sm text-foreground">
						{event.location || "Location TBC"}
					</p>
				</div>

				<div className="mt-5 grid gap-2 sm:grid-cols-2">
					{primaryLink && primaryLink !== "#" ? (
						<a
							href={primaryLink}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
						>
							{formatPrimaryLinkLabel(primaryLink)}
						</a>
					) : (
						<span className="inline-flex h-11 items-center justify-center rounded-lg bg-muted px-4 text-sm font-medium text-muted-foreground">
							Link coming soon
						</span>
					)}
					<Link
						href={homePath}
						className="inline-flex h-11 items-center justify-center rounded-lg border border-border/80 bg-background/70 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
					>
						Browse all events
					</Link>
				</div>
			</section>
		</div>
	);
}
