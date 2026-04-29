"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { COMMUNITY_INVITE_CONFIG } from "@/features/social/config";
import { cn } from "@/lib/utils";
import {
	ArrowRight,
	CalendarPlus,
	Check,
	Clock,
	Euro,
	Filter,
	Map,
	MapPin,
	Megaphone,
	MessageCircle,
	Moon,
	MousePointer2,
	Music2,
	Navigation,
	Route,
	Search,
	Share2,
	Star,
	Ticket,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const storySteps = [
	{
		id: "signal",
		kicker: "The Problem",
		title: "Fête weekend should feel electric, not impossible to plan.",
		body: "Paris is full of music, but the useful details are scattered across flyers, posts, venue pages and group chats. Fête Finder gives the weekend a readable shape before everyone starts moving.",
		points: [
			"Scattered listings",
			"Unclear locations",
			"Group chat indecision",
		],
	},
	{
		id: "map",
		kicker: "The Map",
		title: "Start with the part of Paris you actually want to move through.",
		body: "Fête Finder turns the city into a practical weekend guide, so people can scan by arrondissement, spot nearby picks and avoid zig-zagging across town without a plan.",
		points: ["Arrondissement view", "Nearby picks", "Route-first planning"],
	},
	{
		id: "filters",
		kicker: "The Filters",
		title: "Find the sound, setting and price that match your weekend.",
		body: "Filters make the experience feel less like research and more like choosing a vibe: genre, venue type, price, age, time and curated picks all working together.",
		points: ["Genre and vibe", "Free or paid", "Indoor or outdoor"],
	},
	{
		id: "event",
		kicker: "The Pick",
		title: "Open one event and get the useful details fast.",
		body: "Every event card is designed for fast decisions: time, address, price, host origin, venue setting and share actions without burying the essentials.",
		points: ["Readable details", "OOOC picks", "Shareable cards"],
	},
	{
		id: "plan",
		kicker: "The Plan",
		title: "Save it, share it, then move.",
		body: "The app is built for the way people actually travel and go out: send it to the chat, save the event, open directions and keep the weekend moving.",
		points: ["Calendar saves", "Native share", "Map links"],
	},
	{
		id: "community",
		kicker: "The Community",
		title: "Find the people already out, sharing tips, plans and next moves.",
		body: "The OOOC community adds the live bit: real updates, recommendations and people to move with once you're in Paris.",
		points: ["Live updates", "OOOC community", "Weekend travel energy"],
	},
] as const;

type StoryStepId = (typeof storySteps)[number]["id"];

const featureStats = [
	{ label: "Built around", value: "Paris" },
	{ label: "Made for", value: "Fête weekend" },
	{ label: "Live layer", value: "Community" },
] as const;

const filters = [
	"Afrobeats",
	"Free",
	"Outdoor",
	"11e",
	"This weekend",
	"OOOC Pick",
];

const itinerary = [
	{ time: "18:30", label: "Start east", area: "11e" },
	{ time: "20:15", label: "Live set", area: "10e" },
	{ time: "22:00", label: "Late move", area: "18e" },
] as const;

function MiniMap({ activeStep }: { activeStep: StoryStepId }) {
	const isPlanActive = activeStep === "plan" || activeStep === "community";

	return (
		<div className="ooo-grain relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-[linear-gradient(145deg,color-mix(in_oklab,var(--card)_92%,#f0b668_8%),color-mix(in_oklab,var(--card)_82%,#244a4e_18%))] p-4 shadow-[0_24px_58px_-42px_rgba(22,16,10,0.74)]">
			<div className="relative flex items-center justify-between">
				<Badge className="rounded-full border-[#fff4df]/50 bg-[#fff7ea]/78 text-[#25464a]">
					<Map className="h-3 w-3" />
					Weekend map
				</Badge>
				<Badge variant="outline" className="bg-background/58">
					42 picks
				</Badge>
			</div>

			<div className="relative mt-5 grid gap-3">
				<div className="rounded-2xl border border-border/70 bg-background/62 p-3">
					<div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/78 px-3 py-2">
						<Search className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm text-muted-foreground">
							Search areas, sounds, venues
						</span>
					</div>
				</div>

				<div className="grid gap-2">
					{[
						{
							area: "11e",
							title: "Oberkampf / Bastille",
							count: "8 picks",
							tone: "bg-[#a35f3b]",
						},
						{
							area: "10e",
							title: "Canal Saint-Martin",
							count: "6 picks",
							tone: "bg-[#244a4e]",
						},
						{
							area: "18e",
							title: "Pigalle / Montmartre",
							count: "5 picks",
							tone: "bg-[#6d7e64]",
						},
					].map((item, index) => (
						<div
							key={item.area}
							className={cn(
								"grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 rounded-2xl border p-3 transition-all duration-500",
								index === 0
									? "border-[#f0b668]/60 bg-[#fff7ea]/76 shadow-[0_18px_38px_-34px_rgba(32,20,12,0.8)]"
									: "border-border/70 bg-card/66",
							)}
						>
							<span
								className={cn(
									"flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white",
									item.tone,
								)}
							>
								{item.area}
							</span>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-foreground">
									{item.title}
								</p>
								<p className="text-xs text-muted-foreground">
									{index === 0 ? "Selected area" : "Nearby route option"}
								</p>
							</div>
							<Badge variant="outline" className="bg-background/62">
								{item.count}
							</Badge>
						</div>
					))}
				</div>

				<div
					className={cn(
						"rounded-2xl border border-[#244a4e]/25 bg-[#244a4e] p-3 text-white transition-opacity duration-500",
						isPlanActive ? "opacity-100" : "opacity-80",
					)}
				>
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-[10px] uppercase tracking-[0.18em] text-white/62">
								Suggested movement
							</p>
							<p className="mt-1 text-sm font-semibold">
								11e start → 10e live set → 18e late move
							</p>
						</div>
						<Navigation className="h-5 w-5 shrink-0 text-[#f0b668]" />
					</div>
				</div>
			</div>
		</div>
	);
}

function DemoStage({ activeStep }: { activeStep: StoryStepId }) {
	if (activeStep === "signal") {
		return (
			<div className="rounded-[1.35rem] border border-border/70 bg-card/72 p-4">
				<div className="space-y-4">
					<div className="flex items-end gap-2">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6d7e64] text-[10px] font-semibold text-white">
							M
						</div>
						<div className="max-w-[78%] rounded-[1.1rem] rounded-bl-sm bg-background/82 px-4 py-3 text-sm leading-snug text-foreground shadow-[0_10px_22px_-20px_rgba(20,14,9,0.65)]">
							Where should we go this weekend?
						</div>
					</div>
					<div className="flex items-end justify-end gap-2">
						<div className="max-w-[78%] rounded-[1.1rem] rounded-br-sm bg-[#244a4e] px-4 py-3 text-sm leading-snug text-white shadow-[0_10px_22px_-20px_rgba(20,14,9,0.65)]">
							Is this free?
						</div>
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#a35f3b] text-[10px] font-semibold text-white">
							A
						</div>
					</div>
					<div className="flex items-end gap-2">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4944d] text-[10px] font-semibold text-white">
							S
						</div>
						<div className="max-w-[78%] rounded-[1.1rem] rounded-bl-sm bg-background/82 px-4 py-3 text-sm leading-snug text-foreground shadow-[0_10px_22px_-20px_rgba(20,14,9,0.65)]">
							Send the location
						</div>
					</div>
					<div className="ml-9 rounded-[1.1rem] border border-[#244a4e]/18 bg-[#fff7ea]/82 px-4 py-3 shadow-[0_14px_28px_-24px_rgba(20,14,9,0.7)]">
						<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							Fête Finder
						</p>
						<p className="mt-1 text-sm font-semibold leading-snug text-foreground">
							8 free picks near Oberkampf. Start here, then move toward Canal
							Saint-Martin.
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (activeStep === "map") {
		return <MiniMap activeStep={activeStep} />;
	}

	if (activeStep === "filters") {
		return (
			<div className="rounded-[1.35rem] border border-border/70 bg-card/72 p-4">
				<div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/64 px-3 py-2">
					<Filter className="h-4 w-4 text-[#244a4e]" />
					<span className="text-sm text-muted-foreground">
						Narrow the weekend in seconds
					</span>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-2">
					{filters.map((filter) => (
						<span
							key={filter}
							className="rounded-full border border-[#244a4e]/36 bg-[#244a4e] px-3 py-2 text-center text-xs text-white"
						>
							{filter}
						</span>
					))}
				</div>
				<div className="mt-4 rounded-2xl border border-[#f0b668]/55 bg-[#fff7ea]/76 p-4">
					<p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
						Filtered route
					</p>
					<p className="mt-1 text-lg font-semibold text-foreground">
						Free outdoor Afrobeats near the 11e
					</p>
				</div>
			</div>
		);
	}

	if (activeStep === "community") {
		return (
			<div className="rounded-[1.35rem] border border-border/70 bg-[#244a4e] p-5 text-white">
				<div className="flex items-center gap-3">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12">
						<MessageCircle className="h-5 w-5" />
					</div>
					<div>
						<p className="text-[10px] uppercase tracking-[0.18em] text-white/58">
							OOOC Community
						</p>
						<p className="text-base font-semibold">
							Live Fête weekend updates from people in Paris
						</p>
					</div>
				</div>
				<div className="mt-5 grid gap-3 text-sm text-white/76">
					<p>18-35 travellers and locals moving through the same weekend.</p>
					<p>
						Recommendations, meeting points and useful “where next?” signal.
					</p>
				</div>
				<div className="mt-5 rounded-2xl border border-white/12 bg-white/10 p-4">
					<p className="text-[10px] uppercase tracking-[0.18em] text-white/58">
						Live layer
					</p>
					<p className="mt-1 text-sm font-semibold">
						“Heading to Bastille now. Anyone found a good late set?”
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-border/75 bg-card/86 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<Badge className="rounded-full bg-[#211912] text-white">
							<Star className="h-3 w-3 fill-current" />
							OOOC Pick
						</Badge>
						<Badge variant="outline">11e</Badge>
					</div>
					<h3 className="mt-3 text-xl font-semibold text-foreground">
						Rooftop Rhythm Session
					</h3>
				</div>
				<Music2 className="mt-1 h-5 w-5 text-[#a35f3b]" />
			</div>
			<div className="mt-4 grid gap-2 text-sm text-muted-foreground">
				<p className="flex items-center gap-2">
					<Clock className="h-4 w-4" />
					20:00 - late · Saturday
				</p>
				<p className="flex items-center gap-2">
					<MapPin className="h-4 w-4" />
					Near Oberkampf
				</p>
				<p className="flex items-center gap-2">
					<Euro className="h-4 w-4" />
					Free entry
				</p>
			</div>
			<div
				className={cn(
					"mt-5 grid grid-cols-3 gap-2 transition-opacity duration-500",
					activeStep === "plan" ? "opacity-100" : "opacity-55",
				)}
			>
				<Button size="sm" variant="outline" className="rounded-full">
					<CalendarPlus className="h-3.5 w-3.5" />
					Save
				</Button>
				<Button size="sm" variant="outline" className="rounded-full">
					<Share2 className="h-3.5 w-3.5" />
					Share
				</Button>
				<Button size="sm" className="rounded-full">
					<Route className="h-3.5 w-3.5" />
					Route
				</Button>
			</div>
			{activeStep === "plan" && (
				<div className="mt-4 rounded-2xl border border-[#244a4e]/25 bg-[#244a4e] p-3 text-white">
					<p className="text-[10px] uppercase tracking-[0.18em] text-white/62">
						Next move
					</p>
					<p className="mt-1 text-sm font-semibold">
						Saved, shared, and ready to open in maps.
					</p>
				</div>
			)}
		</div>
	);
}

function DemoPanel({ activeStep }: { activeStep: StoryStepId }) {
	return (
		<div className="w-full max-w-[34rem]">
			<div className="rounded-[2rem] border border-border/70 bg-card/82 p-3 shadow-[0_30px_90px_-58px_rgba(24,16,10,0.9)] backdrop-blur-xl">
				<div className="overflow-hidden rounded-[1.55rem] border border-border/70 bg-background/72">
					<div className="flex items-center justify-between border-b border-border/65 px-4 py-3">
						<div className="flex items-center gap-2">
							<span className="h-2.5 w-2.5 rounded-full bg-[#a35f3b]" />
							<span className="h-2.5 w-2.5 rounded-full bg-[#c4944d]" />
							<span className="h-2.5 w-2.5 rounded-full bg-[#6d7e64]" />
						</div>
						<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
							Fête Finder
						</p>
					</div>

					<div className="grid gap-4 p-4">
						<div
							key={activeStep}
							className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
						>
							<DemoStage activeStep={activeStep} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function MobileStepPreview({ stepId }: { stepId: StoryStepId }) {
	if (stepId === "map") {
		return <MiniMap activeStep="map" />;
	}

	if (stepId === "filters") {
		return (
			<div className="rounded-[1.35rem] border border-border/70 bg-card/72 p-4">
				<div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/64 px-3 py-2">
					<Filter className="h-4 w-4 text-[#244a4e]" />
					<span className="text-sm text-muted-foreground">
						Narrow the weekend in seconds
					</span>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					{filters.map((filter) => (
						<span
							key={filter}
							className="rounded-full border border-[#244a4e]/36 bg-[#244a4e] px-3 py-1.5 text-xs text-white"
						>
							{filter}
						</span>
					))}
				</div>
			</div>
		);
	}

	if (stepId === "event") {
		return (
			<div className="rounded-[1.35rem] border border-border/70 bg-card/78 p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<Badge className="rounded-full bg-[#211912] text-white">
							<Star className="h-3 w-3 fill-current" />
							OOOC Pick
						</Badge>
						<h3 className="mt-3 text-xl font-semibold text-foreground">
							Rooftop Rhythm Session
						</h3>
					</div>
					<Badge variant="outline">11e</Badge>
				</div>
				<div className="mt-4 grid gap-2 text-sm text-muted-foreground">
					<p className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						20:00 - late
					</p>
					<p className="flex items-center gap-2">
						<MapPin className="h-4 w-4" />
						Near Oberkampf
					</p>
					<p className="flex items-center gap-2">
						<Euro className="h-4 w-4" />
						Free entry
					</p>
				</div>
			</div>
		);
	}

	if (stepId === "plan") {
		return (
			<div className="rounded-[1.35rem] border border-border/70 bg-card/78 p-4">
				<div className="grid grid-cols-3 gap-2">
					{[
						{ label: "Save", icon: CalendarPlus },
						{ label: "Share", icon: Share2 },
						{ label: "Route", icon: Route },
					].map((action) => {
						const Icon = action.icon;
						return (
							<div
								key={action.label}
								className="rounded-2xl border border-border/70 bg-background/62 p-3 text-center"
							>
								<Icon className="mx-auto h-4 w-4 text-[#244a4e]" />
								<p className="mt-2 text-xs font-medium text-foreground">
									{action.label}
								</p>
							</div>
						);
					})}
				</div>
			</div>
		);
	}

	if (stepId === "community") {
		return (
			<div className="rounded-[1.35rem] border border-border/70 bg-[#244a4e] p-4 text-white">
				<div className="flex items-center gap-3">
					<div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12">
						<MessageCircle className="h-5 w-5" />
					</div>
					<div>
						<p className="text-[10px] uppercase tracking-[0.18em] text-white/58">
							OOOC Community
						</p>
						<p className="text-sm font-semibold">
							Live Fête weekend updates from people in Paris
						</p>
					</div>
				</div>
				<div className="mt-4 grid gap-2 text-sm text-white/76">
					<p>18-35 travellers and locals moving through the same weekend.</p>
					<p>
						Recommendations, meeting points and useful “where next?” signal.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-[1.35rem] border border-border/70 bg-card/72 p-4">
			<div className="space-y-4">
				<div className="flex items-end gap-2">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6d7e64] text-[10px] font-semibold text-white">
						M
					</div>
					<div className="max-w-[78%] rounded-[1.1rem] rounded-bl-sm bg-background/82 px-4 py-3 text-sm leading-snug text-foreground shadow-[0_10px_22px_-20px_rgba(20,14,9,0.65)]">
						Where should we go this weekend?
					</div>
				</div>
				<div className="flex items-end justify-end gap-2">
					<div className="max-w-[78%] rounded-[1.1rem] rounded-br-sm bg-[#244a4e] px-4 py-3 text-sm leading-snug text-white shadow-[0_10px_22px_-20px_rgba(20,14,9,0.65)]">
						Is this free?
					</div>
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#a35f3b] text-[10px] font-semibold text-white">
						A
					</div>
				</div>
				<div className="flex items-end gap-2">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4944d] text-[10px] font-semibold text-white">
						S
					</div>
					<div className="max-w-[78%] rounded-[1.1rem] rounded-bl-sm bg-background/82 px-4 py-3 text-sm leading-snug text-foreground shadow-[0_10px_22px_-20px_rgba(20,14,9,0.65)]">
						Send the location
					</div>
				</div>
				<div className="ml-9 rounded-[1.1rem] border border-[#244a4e]/18 bg-[#fff7ea]/82 px-4 py-3 shadow-[0_14px_28px_-24px_rgba(20,14,9,0.7)]">
					<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
						Fête Finder
					</p>
					<p className="mt-1 text-sm font-semibold leading-snug text-foreground">
						8 free picks near Oberkampf. Start with this one, then move toward
						Canal Saint-Martin.
					</p>
				</div>
			</div>
		</div>
	);
}

export function HowItWorksExperience() {
	const [activeStep, setActiveStep] = useState<StoryStepId>("signal");

	useEffect(() => {
		const sections =
			document.querySelectorAll<HTMLElement>("[data-story-step]");
		if (sections.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visibleEntry = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
				const nextStep = visibleEntry?.target.getAttribute("data-story-step");
				if (nextStep && storySteps.some((step) => step.id === nextStep)) {
					setActiveStep(nextStep as StoryStepId);
				}
			},
			{
				rootMargin: "-30% 0px -45% 0px",
				threshold: [0.2, 0.45, 0.7],
			},
		);

		for (const section of sections) {
			observer.observe(section);
		}

		return () => observer.disconnect();
	}, []);

	return (
		<div className="overflow-hidden">
			<section className="relative px-4 py-16 sm:px-6 lg:min-h-[calc(100svh-8rem)] lg:px-8 lg:py-20">
				<div className="ooo-grain absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0)),linear-gradient(120deg,color-mix(in_oklab,var(--background)_82%,#dca15f_18%),color-mix(in_oklab,var(--background)_70%,#315b5f_30%))]" />
				<div className="absolute inset-0 bg-[linear-gradient(rgba(62,42,26,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(62,42,26,0.07)_1px,transparent_1px)] bg-[length:56px_56px]" />
				<div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(25rem,0.78fr)] lg:items-center lg:gap-16 xl:gap-20">
					<div className="max-w-4xl">
						<p className="text-[11px] font-medium uppercase tracking-[0.22em] text-foreground/62">
							Out Of Office Collective
						</p>
						<h1 className="mt-5 max-w-[9ch] text-[clamp(4rem,14vw,8rem)] font-light leading-[0.82] text-foreground [font-family:var(--ooo-font-display)] lg:text-[clamp(5.6rem,7.2vw,8.4rem)] xl:text-[clamp(6rem,7vw,9rem)]">
							Your Fête weekend, beautifully mapped.
						</h1>
						<p className="mt-8 max-w-2xl text-xl leading-relaxed text-foreground/72 sm:text-2xl lg:text-xl xl:text-2xl">
							Fête Finder is the OOOC guide for Paris during Fête de la Musique
							weekend: curated events, practical filters, shareable plans and a
							live community of like-minded people on the ground.
						</p>
						<div className="mt-9 flex flex-col gap-3 sm:flex-row">
							<Link
								href={`${basePath || ""}/`}
								className={cn(buttonVariants(), "h-11 rounded-full px-5")}
							>
								Explore the map
								<ArrowRight className="h-4 w-4" />
							</Link>
							<Link
								href={COMMUNITY_INVITE_CONFIG.WHATSAPP_URL}
								target="_blank"
								rel="noopener noreferrer"
								className={cn(
									buttonVariants({ variant: "outline" }),
									"h-11 rounded-full bg-background/54 px-5",
								)}
							>
								Join the community
								<MessageCircle className="h-4 w-4" />
							</Link>
						</div>
					</div>

					<div className="ooo-grain relative overflow-hidden rounded-[1.75rem] border border-white/48 bg-[linear-gradient(150deg,color-mix(in_oklab,var(--card)_88%,#fff7ea_12%),color-mix(in_oklab,var(--card)_82%,#244a4e_18%))] p-4 shadow-[0_34px_90px_-58px_rgba(21,14,9,0.92)] backdrop-blur-xl lg:justify-self-end">
						<div className="relative rounded-[1.35rem] border border-border/70 bg-background/76 p-5 shadow-[0_1px_0_rgba(255,255,255,0.48)_inset]">
							<div className="flex items-start justify-between gap-6">
								<div>
									<p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
										Weekend route
									</p>
									<p className="mt-2 max-w-60 text-2xl font-semibold leading-none text-foreground sm:text-3xl">
										Move east, then follow the night north.
									</p>
								</div>
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/30 bg-[#244a4e] text-white shadow-[0_16px_36px_-24px_rgba(13,45,49,0.9)]">
									<Moon className="h-5 w-5" />
								</div>
							</div>

							<div className="mt-5 flex flex-wrap gap-2">
								<Badge className="rounded-full border-[#244a4e]/15 bg-[#244a4e] text-white">
									<Route className="h-3 w-3" /> 3 curated stops
								</Badge>
								<Badge
									variant="outline"
									className="rounded-full bg-background/58"
								>
									2 neighbourhoods
								</Badge>
							</div>

							<div className="relative mt-7">
								<div className="grid gap-4">
									{itinerary.map((item, index) => (
										<div
											key={item.time}
											className="grid grid-cols-[3.6rem_1.45rem_1fr_auto] items-center gap-3"
										>
											<p className="text-sm font-semibold tabular-nums text-foreground">
												{item.time}
											</p>
											<div className="relative flex h-full items-center justify-center">
												{index < itinerary.length - 1 && (
													<svg
														aria-hidden="true"
														className="absolute left-1/2 top-1/2 z-0 h-[calc(100%+1rem)] w-4 -translate-x-1/2 overflow-visible"
														preserveAspectRatio="none"
														viewBox="0 0 16 100"
													>
														<path
															d={
																index === 0
																	? "M8 0 C8 28 3 35 8 100"
																	: "M8 0 C13 32 8 46 8 100"
															}
															fill="none"
															stroke={
																index === 0
																	? "url(#routeSegmentOne)"
																	: "url(#routeSegmentTwo)"
															}
															strokeLinecap="round"
															strokeWidth="2.25"
															vectorEffect="non-scaling-stroke"
														/>
														<defs>
															<linearGradient
																id={
																	index === 0
																		? "routeSegmentOne"
																		: "routeSegmentTwo"
																}
																x1="0"
																x2="0"
																y1="0"
																y2="1"
															>
																<stop
																	offset="0"
																	stopColor={
																		index === 0 ? "#a35f3b" : "#244a4e"
																	}
																/>
																<stop
																	offset="1"
																	stopColor={
																		index === 0 ? "#244a4e" : "#6d7e64"
																	}
																/>
															</linearGradient>
														</defs>
													</svg>
												)}
												<span
													className={cn(
														"relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white shadow-[0_12px_26px_-18px_rgba(20,14,9,0.75)]",
														index === 0
															? "bg-[#a35f3b]"
															: index === 1
																? "bg-[#244a4e]"
																: "bg-[#6d7e64]",
													)}
												>
													{index + 1}
												</span>
											</div>
											<div className="min-w-0 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 shadow-[0_14px_34px_-30px_rgba(20,14,9,0.72)]">
												<p className="text-sm font-semibold text-foreground">
													{item.label}
												</p>
												<p className="mt-0.5 text-xs text-muted-foreground">
													Curated stop {index + 1}
												</p>
											</div>
											<Badge
												variant="outline"
												className="rounded-full bg-background/62 px-3"
											>
												{item.area}
											</Badge>
										</div>
									))}
								</div>
							</div>

							<div className="mt-6 rounded-2xl border border-[#244a4e]/18 bg-[#244a4e]/8 p-4">
								<div className="flex items-center justify-between gap-4">
									<div>
										<p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
											Ready for maps
										</p>
										<p className="mt-1 text-sm font-semibold text-foreground">
											11e start → 10e live set → 18e late move
										</p>
									</div>
									<Navigation className="h-5 w-5 shrink-0 text-[#244a4e]" />
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="border-y border-border/70 bg-card/58 px-4 py-6 backdrop-blur sm:px-6 lg:px-8">
				<div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-3">
					{featureStats.map((stat) => (
						<div
							key={stat.label}
							className="flex items-center justify-between border-b border-border/60 py-3 sm:border-b-0 sm:border-r sm:px-5 last:sm:border-r-0"
						>
							<span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								{stat.label}
							</span>
							<span className="text-lg font-semibold text-foreground">
								{stat.value}
							</span>
						</div>
					))}
				</div>
			</section>

			<section className="relative px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
				<div className="mx-auto grid max-w-[108rem] gap-4 lg:gap-2">
					{storySteps.map((step, index) => (
						<article
							key={step.id}
							data-story-step={step.id}
							className="grid border-t border-border/70 py-12 lg:min-h-[48svh] lg:grid-cols-[minmax(0,54rem)_minmax(28rem,34rem)] lg:items-center lg:gap-12 lg:py-10 xl:min-h-[52svh] xl:gap-20"
						>
							<div>
								<div className="flex items-center gap-3">
									<span
										className={cn(
											"flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300",
											activeStep === step.id
												? "border-[#244a4e] bg-[#244a4e] text-white"
												: "border-border/70 bg-card/70 text-muted-foreground",
										)}
									>
										{index + 1}
									</span>
									<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
										{step.kicker}
									</p>
								</div>
								<h2 className="mt-6 max-w-3xl text-[clamp(2.4rem,7vw,5.8rem)] font-light leading-[0.9] text-foreground [font-family:var(--ooo-font-display)] lg:text-[clamp(3.8rem,4.6vw,5.2rem)] xl:text-[clamp(4.2rem,4.8vw,5.6rem)]">
									{step.title}
								</h2>
								<p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground lg:text-base xl:text-lg">
									{step.body}
								</p>
								<div className="mt-6 flex flex-wrap gap-2">
									{step.points.map((point) => (
										<div
											key={point}
											className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/64 px-3.5 py-2"
										>
											<Check className="h-3.5 w-3.5 text-[#6d7e64]" />
											<span className="text-sm font-medium text-foreground">
												{point}
											</span>
										</div>
									))}
								</div>
								<div className="mt-8 lg:hidden">
									<MobileStepPreview stepId={step.id} />
								</div>
							</div>

							<div
								className={cn(
									"hidden justify-end transition-all duration-500 lg:flex",
									activeStep === step.id
										? "translate-y-0 opacity-100"
										: "translate-y-6 opacity-75",
								)}
							>
								<DemoPanel activeStep={step.id} />
							</div>
						</article>
					))}
				</div>
			</section>

			<section className="px-4 pb-20 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl border-t border-border/70 pt-12">
					<div className="max-w-3xl">
						<p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Choose your lane
						</p>
						<h2 className="mt-3 text-[clamp(2.4rem,7vw,5.6rem)] font-light leading-[0.9] text-foreground [font-family:var(--ooo-font-display)]">
							Use it for the weekend, the community, or the crowd.
						</h2>
					</div>
					<div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{[
							{
								icon: MessageCircle,
								title: "Join the community",
								body: "Get live on-the-ground access to OOOC updates and like-minded 18-35 travellers in Paris for Fête weekend.",
								href: COMMUNITY_INVITE_CONFIG.WHATSAPP_URL,
								cta: "Join community",
								external: true,
							},
							{
								icon: Users,
								title: "For attendees",
								body: "Discover the right music, area and plan before the weekend gets messy.",
								href: `${basePath || ""}/`,
								cta: "Explore events",
								external: false,
							},
							{
								icon: Ticket,
								title: "For hosts",
								body: "Submit your event so people can find it where they are already planning.",
								href: `${basePath || ""}/submit-event`,
								cta: "Submit event",
								external: false,
							},
							{
								icon: Megaphone,
								title: "For partners",
								body: "Promote a listing when high-intent people are choosing where to go.",
								href: `${basePath || ""}/feature-event`,
								cta: "Promote event",
								external: false,
							},
						].map((item) => {
							const Icon = item.icon;
							return (
								<Link
									key={item.title}
									href={item.href}
									target={item.external ? "_blank" : undefined}
									rel={item.external ? "noopener noreferrer" : undefined}
									className="group rounded-[1.5rem] border border-border/70 bg-card/70 p-6 shadow-[0_18px_48px_-40px_rgba(22,16,10,0.72)] transition-transform duration-300 hover:-translate-y-1 hover:bg-card/90"
								>
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#211912] text-white">
										<Icon className="h-5 w-5" />
									</div>
									<h3 className="mt-6 text-2xl font-semibold text-foreground">
										{item.title}
									</h3>
									<p className="mt-3 min-h-20 text-sm leading-relaxed text-muted-foreground">
										{item.body}
									</p>
									<p className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 group-hover:underline">
										{item.cta}
										<ArrowRight className="h-4 w-4" />
									</p>
								</Link>
							);
						})}
					</div>
				</div>
			</section>

			<section className="px-4 pb-24 sm:px-6 lg:px-8">
				<div className="ooo-grain mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-[linear-gradient(145deg,color-mix(in_oklab,var(--card)_84%,#f0b668_16%),color-mix(in_oklab,var(--card)_78%,#244a4e_22%))] p-8 text-center shadow-[0_28px_80px_-58px_rgba(22,16,10,0.86)] sm:p-12">
					<Route className="mx-auto h-7 w-7 text-[#a35f3b]" />
					<h2 className="mx-auto mt-5 max-w-3xl text-[clamp(2.6rem,7vw,6rem)] font-light leading-[0.88] text-foreground [font-family:var(--ooo-font-display)]">
						Ready to find your route?
					</h2>
					<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
						Open the map, join the OOOC chat and make Fête weekend easier to
						follow.
					</p>
					<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
						<Link
							href={`${basePath || ""}/`}
							className={cn(buttonVariants(), "h-11 rounded-full px-6")}
						>
							Explore Fête Finder
							<MousePointer2 className="h-4 w-4" />
						</Link>
						<Link
							href={COMMUNITY_INVITE_CONFIG.WHATSAPP_URL}
							target="_blank"
							rel="noopener noreferrer"
							className={cn(
								buttonVariants({ variant: "outline" }),
								"h-11 rounded-full bg-background/60 px-6",
							)}
						>
							Join the community
							<MessageCircle className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
