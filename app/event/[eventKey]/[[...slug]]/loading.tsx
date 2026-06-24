import Header from "@/components/Header";
import { X } from "lucide-react";
import Link from "next/link";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const homePath = basePath && basePath !== "/" ? basePath : "/";

const Pulse = ({ className }: { className: string }) => (
	<div
		className={`animate-pulse rounded bg-muted/55 ${className}`}
		aria-hidden="true"
	/>
);

export default function EventShareLoading() {
	return (
		<div className="ooo-site-shell">
			<Header />
			<main
				id="main-content"
				className="container mx-auto px-4 py-8"
				tabIndex={-1}
			>
				<div
					className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-[4px]"
					style={{
						paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
						paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
						paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
						paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
					}}
				>
					<section
						className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] w-full max-w-[38rem] overflow-y-auto rounded-[22px] border border-border/80 bg-card/95 p-4 shadow-[0_36px_90px_-52px_rgba(0,0,0,0.9)] sm:max-h-[90vh] sm:rounded-[26px] sm:p-5"
						aria-busy="true"
						aria-label="Loading event details"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<Pulse className="h-3 w-44" />
								<Pulse className="mt-3 h-8 w-11/12" />
								<Pulse className="mt-2 h-8 w-3/5" />
							</div>
							<Link
								href={homePath}
								className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-lg leading-none text-foreground transition-colors hover:bg-accent"
								aria-label="Close event details"
							>
								<X className="size-4" aria-hidden="true" />
							</Link>
						</div>

						<div className="mt-3 flex flex-wrap gap-1.5">
							<Pulse className="h-7 w-16 rounded-full" />
							<Pulse className="h-7 w-20 rounded-full" />
							<Pulse className="h-7 w-14 rounded-full" />
						</div>

						<div className="mt-6 grid gap-2 sm:grid-cols-2">
							{["Date", "Time", "Price", "Venue type"].map((label) => (
								<div
									key={label}
									className="rounded-xl border border-border/70 bg-background/60 p-3"
								>
									<p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
										{label}
									</p>
									<Pulse className="mt-2 h-4 w-3/4" />
								</div>
							))}
						</div>

						<div className="mt-2 rounded-xl border border-border/70 bg-background/60 p-3">
							<Pulse className="h-3 w-24" />
							<Pulse className="mt-3 h-10 w-full rounded-lg" />
						</div>

						<div className="mt-5 grid gap-2 sm:grid-cols-2">
							<Pulse className="h-11 w-full rounded-lg" />
							<Pulse className="h-11 w-full rounded-lg" />
						</div>
					</section>
				</div>
			</main>
		</div>
	);
}
