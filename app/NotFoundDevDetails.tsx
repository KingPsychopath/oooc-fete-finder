"use client";

import { Button } from "@/components/ui/button";
import { usePathname, useSearchParams } from "next/navigation";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const withBasePath = (path: string): string => `${basePath}${path}`;

export function NotFoundDevDetails() {
	const pathname = usePathname() || "/";
	const searchParams = useSearchParams();
	const query = searchParams.toString();
	const requestedPath = query ? `${pathname}?${query}` : pathname;

	return (
		<details className="rounded-xl border border-border/80 bg-card/80 p-4 text-left">
			<summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
				Dev details
			</summary>
			<div className="mt-3 space-y-3">
				<div>
					<p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
						Requested route
					</p>
					<code className="mt-1 block rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs text-foreground">
						{requestedPath}
					</code>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						nativeButton={false}
						variant="outline"
						size="sm"
						render={<a href={requestedPath} target="_blank" rel="noreferrer" />}
					>
						Open requested route
					</Button>
					<Button
						nativeButton={false}
						variant="outline"
						size="sm"
						render={<a href={withBasePath("/event-modal-lab")} target="_blank" rel="noreferrer" />}
					>
						Open modal lab
					</Button>
					<Button
						nativeButton={false}
						variant="outline"
						size="sm"
						render={<a href={withBasePath("/admin")} target="_blank" rel="noreferrer" />}
					>
						Open admin
					</Button>
				</div>
			</div>
		</details>
	);
}
