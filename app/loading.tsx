import Header from "@/components/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
	return (
		<div className="ooo-site-shell">
			<Header />
			<main id="main-content" className="container mx-auto px-4 py-8">
				<section className="mb-8" aria-label="Loading intro">
					<Skeleton className="h-3 w-44" />
					<Skeleton className="mt-3 h-9 w-full max-w-md" />
					<Skeleton className="mt-2 h-4 w-full max-w-xl" />
					<div className="mt-6 border-t border-border" role="presentation" />
				</section>

				<section className="mb-8" aria-label="Loading search">
					<div className="min-h-[96px] flex items-center">
						<Skeleton className="h-11 w-full max-w-md rounded-full" />
					</div>
				</section>

				<section className="mb-8" aria-label="Loading featured">
					<Card className="ooo-site-card-soft border">
						<CardHeader className="pb-4">
							<Skeleton className="h-6 w-56" />
							<Skeleton className="mt-2 h-4 w-72" />
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{[1, 2, 3].map((item) => (
									<div
										key={item}
										className="rounded-xl border border-border/70 bg-card/55 p-4"
									>
										<Skeleton className="h-5 w-3/4" />
										<Skeleton className="mt-2 h-4 w-1/2" />
										<Skeleton className="mt-2 h-4 w-2/3" />
										<div className="mt-3 flex gap-2">
											<Skeleton className="h-6 w-16 rounded-full" />
											<Skeleton className="h-6 w-20 rounded-full" />
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="mb-8" aria-label="Loading stats">
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{[1, 2, 3].map((item) => (
							<Card key={item} className="ooo-site-card-soft border">
								<CardContent className="space-y-2 p-4">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-7 w-20" />
								</CardContent>
							</Card>
						))}
					</div>
				</section>

				<section className="mb-8" aria-label="Loading map">
					<Card className="ooo-site-card-soft border">
						<CardHeader className="pb-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-8 w-24 rounded-full" />
							</div>
						</CardHeader>
						<CardContent className="pt-2">
							<Skeleton className="h-44 w-full rounded-lg sm:h-56" />
						</CardContent>
					</Card>
				</section>

				<section className="mb-8" aria-label="Loading filters">
					<Card className="ooo-site-card-soft border">
						<CardHeader>
							<div className="flex items-center justify-between">
								<Skeleton className="h-6 w-36" />
								<Skeleton className="h-8 w-24 rounded-full" />
							</div>
						</CardHeader>
						<CardContent className="space-y-5">
							{[1, 2, 3].map((item) => (
								<div key={item} className="space-y-3">
									<Skeleton className="h-4 w-28" />
									<div className="flex flex-wrap gap-2">
										{[1, 2, 3, 4, 5].map((chip) => (
											<Skeleton key={chip} className="h-8 w-20 rounded-full" />
										))}
									</div>
								</div>
							))}
							<div className="border-t border-border/70 pt-4">
								<Skeleton className="h-9 w-28 rounded-full" />
							</div>
						</CardContent>
					</Card>
				</section>

				<section aria-label="Loading all events">
					<Card className="ooo-site-card-soft border">
						<CardHeader>
							<div className="flex items-center justify-between">
								<Skeleton className="h-6 w-40" />
								<Skeleton className="h-8 w-24 rounded-full" />
							</div>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{[1, 2, 3, 4, 5, 6].map((item) => (
									<div
										key={item}
										className="rounded-xl border border-border/70 bg-card/55 p-4"
									>
										<Skeleton className="h-5 w-3/4" />
										<Skeleton className="mt-2 h-4 w-1/2" />
										<Skeleton className="mt-1.5 h-4 w-2/3" />
										<Skeleton className="mt-1.5 h-4 w-2/5" />
										<div className="mt-3 flex gap-2">
											<Skeleton className="h-6 w-16 rounded-full" />
											<Skeleton className="h-6 w-20 rounded-full" />
										</div>
										<div className="mt-4 flex items-center justify-between">
											<Skeleton className="h-8 w-24 rounded-full" />
											<Skeleton className="h-4 w-16" />
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</section>
			</main>
		</div>
	);
}
