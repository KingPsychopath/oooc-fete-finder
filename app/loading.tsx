import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="container mx-auto px-4 py-8">
				{/* Search Bar Skeleton */}
				<div className="mb-8">
					<div className="min-h-[120px] flex items-center">
						<Skeleton className="h-10 w-full max-w-md mx-auto" />
					</div>
				</div>

				{/* Featured Events Section Skeleton */}
				<div className="mb-8">
					<Card>
						<CardHeader>
							<CardTitle>
								<Skeleton className="h-6 w-40" />
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{[1, 2, 3].map((i) => (
									<div key={i} className="p-4 border rounded-lg space-y-3">
										<div className="flex items-start justify-between gap-3">
											<Skeleton className="h-5 w-3/4" />
											<Skeleton className="h-5 w-12" />
										</div>
										<div className="space-y-2">
											<Skeleton className="h-4 w-1/2" />
											<Skeleton className="h-4 w-2/3" />
										</div>
										<div className="flex flex-wrap gap-2">
											{[1, 2].map((j) => (
												<Skeleton key={j} className="h-6 w-16" />
											))}
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Event Stats Skeleton */}
				<div className="mb-8">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<Card key={i}>
								<CardContent className="p-4">
									<div className="space-y-2">
										<Skeleton className="h-6 w-16" />
										<Skeleton className="h-4 w-24" />
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>

				{/* Collapsible Paris Event Map Skeleton */}
				<div className="mb-8">
					<Card>
						<CardHeader className="pb-3">
							<div className="space-y-3 sm:space-y-0">
								{/* Top row - Title and main info */}
								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-2 flex-wrap">
										<div className="flex items-center space-x-2">
											<Skeleton className="h-5 w-5" />
											<Skeleton className="h-6 w-32" />
										</div>
										<div className="flex items-center space-x-1 mt-1 sm:mt-0">
											<Skeleton className="h-5 w-16" />
											<Skeleton className="h-5 w-12" />
										</div>
									</div>
									{/* Expand/Collapse button */}
									<Skeleton className="h-8 w-20" />
								</div>

								{/* Bottom row - Map Type Toggle */}
								<div className="flex justify-center sm:justify-end">
									<div className="flex items-center space-x-2 bg-muted/50 rounded-lg p-1">
										<Skeleton className="h-4 w-8" />
										<Skeleton className="h-7 w-16" />
										<Skeleton className="h-7 w-12" />
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent className="pt-2 px-3 sm:px-6">
							<div className="relative h-24 sm:h-32 overflow-hidden rounded-md">
								<Skeleton className="w-full h-full" />
								<div className="absolute inset-x-0 bottom-0 h-6 sm:h-8 bg-gradient-to-t from-card to-transparent pointer-events-none rounded-b-md" />
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Filter Panel Skeleton */}
				<div className="mb-8">
					<div className="min-h-[400px]">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>
										<Skeleton className="h-6 w-24" />
									</CardTitle>
									<Skeleton className="h-8 w-20" />
								</div>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Filter sections */}
								{[1, 2, 3, 4].map((i) => (
									<div key={i} className="space-y-3">
										<Skeleton className="h-5 w-20" />
										<div className="flex flex-wrap gap-2">
											{[1, 2, 3, 4].map((j) => (
												<Skeleton key={j} className="h-8 w-20" />
											))}
										</div>
									</div>
								))}

								{/* Clear filters button */}
								<div className="pt-4 border-t">
									<Skeleton className="h-9 w-24" />
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* All Events Section Skeleton */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>
								<Skeleton className="h-6 w-32" />
							</CardTitle>
							<Skeleton className="h-8 w-20" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
								<div key={i} className="p-4 border rounded-lg space-y-3">
									<div className="flex items-start justify-between gap-3">
										<Skeleton className="h-5 w-3/4" />
										<Skeleton className="h-5 w-12" />
									</div>
									<div className="space-y-2">
										<Skeleton className="h-4 w-1/2" />
										<Skeleton className="h-4 w-2/3" />
										<Skeleton className="h-4 w-1/3" />
									</div>
									<div className="flex flex-wrap gap-2">
										{[1, 2, 3].map((j) => (
											<Skeleton key={j} className="h-6 w-16" />
										))}
									</div>
									<div className="flex items-center justify-between pt-2">
										<Skeleton className="h-8 w-20" />
										<Skeleton className="h-4 w-16" />
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
