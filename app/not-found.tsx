import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Home, Map, Music2, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { NotFoundDevDetails } from "./NotFoundDevDetails";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function NotFound() {
	return (
		<div className="ooo-site-shell">
			<main className="container mx-auto max-w-6xl px-4 py-14 sm:py-20">
				<section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/86 shadow-[0_24px_80px_-58px_rgba(20,14,8,0.78)]">
					<div className="absolute inset-0 bg-[linear-gradient(140deg,color-mix(in_oklab,var(--background)_92%,#f0b668_8%),transparent_48%),linear-gradient(180deg,transparent_42%,color-mix(in_oklab,var(--primary)_18%,transparent))]" />
					<div className="relative grid min-h-[34rem] gap-8 p-6 sm:p-9 lg:grid-cols-[1.05fr_0.95fr] lg:p-12">
						<div className="flex flex-col justify-center">
							<div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/64 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
								<Sparkles className="h-3.5 w-3.5" />
								Fete Finder
							</div>
							<h1
								className="mt-5 max-w-2xl text-5xl font-light leading-[0.95] tracking-tight text-foreground sm:text-6xl"
								style={{ fontFamily: "var(--ooo-font-display)" }}
							>
								You drifted off route
							</h1>
							<p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
								This page is not in the current city map. The route may have
								moved, expired, or never existed.
							</p>
							<p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
								No stress. The music is still somewhere nearby. We can guide you
								back home, into the listings, or through the guide.
							</p>

							<div className="mt-7 flex flex-wrap gap-3">
								<Button
									size="lg"
									className="gap-2 rounded-full"
									nativeButton={false}
									render={<Link href={basePath || "/"} />}
								>
									<Home className="h-4 w-4" />
									Return Home
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="gap-2 rounded-full bg-background/56"
									nativeButton={false}
									render={<Link href={`${basePath || ""}/#all-events`} />}
								>
									<Music2 className="h-4 w-4" />
									Browse Events
								</Button>
							</div>

							<div className="mt-8 max-w-sm text-sm text-muted-foreground">
								<Link
									href={`${basePath}/how-it-works`}
									className="group inline-flex items-center gap-2 underline-offset-4 transition-colors hover:text-foreground hover:underline"
								>
									<span>New here? See how Fête Finder works</span>
									<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
								</Link>
							</div>

							{process.env.NODE_ENV === "development" ? (
								<div className="mt-5">
									<NotFoundDevDetails />
								</div>
							) : null}
						</div>

						<aside className="flex items-center justify-center">
							<div className="relative w-full max-w-md rounded-[1.6rem] border border-border/70 bg-background/62 p-4 shadow-[0_30px_70px_-54px_rgba(20,14,8,0.72)] backdrop-blur-md">
								<div className="rounded-[1.25rem] border border-border/70 bg-card/76 p-4">
									<div className="flex items-center justify-between gap-3">
										<p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
											Last known signal
										</p>
										<Compass className="h-4 w-4 text-muted-foreground" />
									</div>
									<div className="mt-5 space-y-3">
										<div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/72 p-3">
											<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#213f43] text-xs font-semibold text-[#fff8eb]">
												01
											</span>
											<div>
												<p className="text-sm font-medium text-foreground">
													Find the nearest sound
												</p>
												<p className="text-xs text-muted-foreground">
													Browse the live city guide
												</p>
											</div>
										</div>
										<div className="ml-4 h-8 border-l border-dashed border-border/80" />
										<div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/72 p-3">
											<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6d7e64] text-xs font-semibold text-white">
												02
											</span>
											<div>
												<p className="text-sm font-medium text-foreground">
													Choose a pocket of Paris
												</p>
												<p className="text-xs text-muted-foreground">
													Map, arrondissement, genre, price
												</p>
											</div>
										</div>
										<div className="ml-4 h-8 border-l border-dashed border-border/80" />
										<div className="flex items-center gap-3 rounded-2xl border border-[#f0b668]/55 bg-[#fff7ea]/76 p-3 dark:bg-[#f0b668]/12">
											<span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#a35f3b] text-xs font-semibold text-white">
												03
											</span>
											<div>
												<p className="text-sm font-medium text-foreground">
													Meet the group back on route
												</p>
												<p className="text-xs text-muted-foreground">
													Share the plan when you land
												</p>
											</div>
										</div>
									</div>
								</div>
								<Link
									href={`${basePath || ""}/#event-map`}
									className="mt-3 flex items-center justify-between rounded-2xl border border-border/70 bg-[#213f43] px-4 py-3 text-sm font-medium text-[#fff8eb] transition-colors hover:bg-[#284f54]"
								>
									<span className="inline-flex items-center gap-2">
										<Map className="h-4 w-4" />
										Follow the map
									</span>
									<Send className="h-4 w-4" />
								</Link>
							</div>
						</aside>
					</div>
				</section>
			</main>
		</div>
	);
}
