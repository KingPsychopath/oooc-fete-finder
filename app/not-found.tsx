import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { Home, MapPin, Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
	return (
		<RouteState
			icon={
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/12">
					<MapPin className="h-8 w-8 text-amber-700 dark:text-amber-300" />
				</div>
			}
			title="Page Not Found"
			description="We couldn't find that route. It may have moved or no longer exists."
			actions={
				<div className="flex flex-col justify-center gap-3 sm:flex-row">
					<Button asChild size="lg" className="flex items-center gap-2">
						<Link href="/">
							<Home className="h-4 w-4" />
							Go Home
						</Link>
					</Button>
					<Button
						asChild
						variant="outline"
						size="lg"
						className="flex items-center gap-2"
					>
						<Link href="/">
							<Search className="h-4 w-4" />
							Find Events
						</Link>
					</Button>
				</div>
			}
			footer="Paris music map is still available on the homepage."
		/>
	);
}
