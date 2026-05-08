"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type InfoPopoverProps = {
	"aria-label": string;
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
} & Pick<
	React.ComponentProps<typeof PopoverContent>,
	"align" | "side" | "sideOffset"
>;

function InfoPopover({
	"aria-label": ariaLabel,
	children,
	className,
	contentClassName,
	align = "center",
	side = "top",
	sideOffset = 8,
}: InfoPopoverProps) {
	const [open, setOpen] = useState(false);
	const pointerClassName = cn(
		"pointer-events-none absolute size-2.5 rotate-45 rounded-[2px] bg-foreground",
		side === "top" && "-bottom-1 left-1/2 -translate-x-1/2",
		side === "bottom" && "-top-1 left-1/2 -translate-x-1/2",
		side === "left" && "-right-1 top-1/2 -translate-y-1/2",
		side === "right" && "-left-1 top-1/2 -translate-y-1/2",
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						aria-label={ariaLabel}
						aria-expanded={open}
						className={cn(
							"ml-2 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground",
							className,
						)}
					>
						<Info className="h-4 w-4" />
					</Button>
				}
			/>
			<PopoverContent
				align={align}
				side={side}
				sideOffset={sideOffset}
				className={cn(
					"relative w-fit max-w-[18rem] overflow-visible rounded-md bg-foreground px-3 py-1.5 text-xs leading-relaxed text-background shadow-md ring-0",
					contentClassName,
				)}
			>
				{children}
				<span aria-hidden="true" className={pointerClassName} />
			</PopoverContent>
		</Popover>
	);
}

export { InfoPopover };
