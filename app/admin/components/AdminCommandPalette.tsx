"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Command, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ADMIN_COMMAND_ITEMS,
	stripAdminBasePath,
	withAdminBasePath,
} from "../config";

type AdminCommandPaletteProps = {
	triggerClassName?: string;
};

const normalize = (value: string): string => value.trim().toLowerCase();
const getRoutePathFromCommandPath = (path: string): string => path.split("#")[0];
const isCommandPathCurrent = (
	currentPathname: string,
	commandPath: string,
): boolean => {
	const routePath = getRoutePathFromCommandPath(commandPath);
	if (routePath === "/admin") {
		return currentPathname === "/admin";
	}
	return (
		currentPathname === routePath ||
		currentPathname.startsWith(`${routePath}/`)
	);
};

export function AdminCommandPalette({
	triggerClassName,
}: AdminCommandPaletteProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const normalizedPathname = stripAdminBasePath(pathname || "/");
	const queryNeedle = normalize(query);

	const filteredCommands = useMemo(() => {
		const filtered = ADMIN_COMMAND_ITEMS.filter((item) => {
			if (!queryNeedle) return true;
			const haystack = [item.label, item.hint, ...item.keywords]
				.join(" ")
				.toLowerCase();
			return haystack.includes(queryNeedle);
		});

		return filtered.sort((left, right) => {
			const leftIsCurrent = isCommandPathCurrent(normalizedPathname, left.path);
			const rightIsCurrent = isCommandPathCurrent(normalizedPathname, right.path);

			if (leftIsCurrent && !rightIsCurrent) return -1;
			if (!leftIsCurrent && rightIsCurrent) return 1;
			return left.label.localeCompare(right.label);
		});
	}, [normalizedPathname, queryNeedle]);

	const openPalette = useCallback(() => {
		setOpen(true);
	}, []);

	const closePalette = useCallback(() => {
		setOpen(false);
		setQuery("");
	}, []);

	const navigateToCommand = useCallback(
		(path: string) => {
			router.push(withAdminBasePath(path));
			closePalette();
		},
		[closePalette, router],
	);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((current) => !current);
				return;
			}

			if (event.key === "Escape") {
				setOpen(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={openPalette}
				className={cn("gap-2", triggerClassName)}
			>
				<Search className="h-3.5 w-3.5" />
				<span>Command</span>
				<span className="rounded border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
					Cmd/Ctrl+K
				</span>
			</Button>

			<Dialog
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);
					if (!nextOpen) {
						setQuery("");
					}
				}}
			>
				<DialogContent className="max-w-[min(700px,calc(100%-1.5rem))] p-0" showCloseButton={false}>
						<DialogHeader className="px-4 pt-4">
							<DialogTitle className="flex items-center gap-2">
								<Command className="h-4 w-4" />
								Jump to admin area or section
							</DialogTitle>
							<DialogDescription>
								Search areas and section anchors, then hit Enter to jump.
							</DialogDescription>
						</DialogHeader>

					<div className="space-y-3 px-4 pb-4">
						<Input
							autoFocus
							placeholder="Try: submissions, factory reset, featured, csv"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && filteredCommands.length > 0) {
									event.preventDefault();
									navigateToCommand(filteredCommands[0].path);
								}
							}}
						/>

						<div className="max-h-[360px] overflow-y-auto rounded-lg border">
							{filteredCommands.length === 0 ? (
								<p className="px-3 py-6 text-sm text-muted-foreground">
									No matching command. Try a broader term.
								</p>
							) : (
								<ul className="divide-y">
										{filteredCommands.map((item) => {
											const isCurrent = isCommandPathCurrent(
												normalizedPathname,
												item.path,
											);
										return (
											<li key={item.id}>
												<button
													type="button"
													onClick={() => navigateToCommand(item.path)}
													className={cn(
														"w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/70",
														isCurrent && "bg-muted/50",
													)}
												>
													<p className="text-sm font-medium">{item.label}</p>
													<p className="mt-0.5 text-xs text-muted-foreground">
														{item.hint}
													</p>
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
