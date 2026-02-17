import { Loader2 } from "lucide-react";

export default function Loading() {
	return (
		<div className="ooo-site-shell min-h-screen">
			<div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">
				<div className="flex items-center gap-3 rounded-full border bg-card/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading page...
				</div>
			</div>
		</div>
	);
}
