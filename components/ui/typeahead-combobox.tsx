"use client";

import { cn } from "@/lib/utils";
import { Check, Search } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

export type TypeaheadComboboxOption = {
	value: string;
	label: string;
	description?: string;
	rightLabel?: string;
	disabled?: boolean;
};

type TypeaheadComboboxProps = {
	options: TypeaheadComboboxOption[];
	onSelect: (option: TypeaheadComboboxOption) => void;
	value?: string;
	onInputChange?: (value: string) => void;
	placeholder?: string;
	emptyMessage?: string;
	label?: string;
	id?: string;
	disabled?: boolean;
	maxVisibleOptions?: number;
	clearOnSelect?: boolean;
	className?: string;
	leadingIcon?: ReactNode;
	trailingAdornment?: ReactNode;
	filterOptions?: (
		options: TypeaheadComboboxOption[],
		query: string,
	) => TypeaheadComboboxOption[];
};

const defaultFilterOptions = (
	options: TypeaheadComboboxOption[],
	query: string,
): TypeaheadComboboxOption[] => {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return options;
	return options.filter((option) =>
		[option.label, option.description, option.rightLabel]
			.filter(Boolean)
			.join(" ")
			.toLowerCase()
			.includes(normalizedQuery),
	);
};

export function TypeaheadCombobox({
	options,
	onSelect,
	value,
	onInputChange,
	placeholder = "Search",
	emptyMessage = "No results",
	label,
	id,
	disabled = false,
	maxVisibleOptions = 8,
	clearOnSelect = false,
	className,
	leadingIcon = <Search className="h-4 w-4" />,
	trailingAdornment,
	filterOptions = defaultFilterOptions,
}: TypeaheadComboboxProps) {
	const generatedId = useId();
	const inputId = id ?? `typeahead-combobox-${generatedId}`;
	const listboxId = `${inputId}-listbox`;
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [inputValue, setInputValue] = useState(value ?? "");
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(0);

	const matchingOptions = useMemo(
		() => filterOptions(options, inputValue),
		[filterOptions, inputValue, options],
	);
	const visibleOptions = useMemo(
		() => matchingOptions.slice(0, maxVisibleOptions),
		[matchingOptions, maxVisibleOptions],
	);
	const hiddenMatchCount = Math.max(
		matchingOptions.length - visibleOptions.length,
		0,
	);
	const optionCount = visibleOptions.length;
	const filteredOptions = visibleOptions;
	const activeIndex =
		filteredOptions.length === 0
			? 0
			: Math.min(highlightedIndex, filteredOptions.length - 1);
	const activeOption = filteredOptions[activeIndex];
	const activeOptionId =
		isOpen && activeOption ? `${listboxId}-option-${activeIndex}` : undefined;

	useEffect(() => {
		if (
			value === undefined ||
			isOpen ||
			value === inputValue ||
			document.activeElement === inputRef.current
		) {
			return;
		}
		setInputValue(value);
	}, [inputValue, isOpen, value]);

	useEffect(() => {
		if (!isOpen) return;
		const handlePointerDown = (event: MouseEvent) => {
			if (
				event.target instanceof Node &&
				containerRef.current &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
				setHighlightedIndex(0);
			}
		};
		document.addEventListener("mousedown", handlePointerDown);
		return () => document.removeEventListener("mousedown", handlePointerDown);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const optionElement = document.getElementById(
			`${listboxId}-option-${activeIndex}`,
		);
		optionElement?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, isOpen, listboxId]);

	const open = useCallback(() => {
		if (disabled) return;
		setIsOpen(true);
		setHighlightedIndex(0);
	}, [disabled]);

	const updateInputValue = (nextValue: string) => {
		setInputValue(nextValue);
		onInputChange?.(nextValue);
		open();
	};

	const selectOption = useCallback(
		(option: TypeaheadComboboxOption) => {
			if (option.disabled) return;
			const nextValue = clearOnSelect ? "" : option.label;
			setInputValue(nextValue);
			onInputChange?.(nextValue);
			setIsOpen(false);
			setHighlightedIndex(0);
			onSelect(option);
		},
		[clearOnSelect, onInputChange, onSelect],
	);

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isOpen) {
			if (event.key === "ArrowDown" || event.key === "Enter") {
				event.preventDefault();
				open();
			}
			return;
		}

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				if (optionCount > 0) {
					setHighlightedIndex((current) =>
						Math.min(current + 1, optionCount - 1),
					);
				}
				break;
			case "ArrowUp":
				event.preventDefault();
				if (optionCount > 0) {
					setHighlightedIndex((current) => Math.max(current - 1, 0));
				}
				break;
			case "Enter":
				if (activeOption) {
					event.preventDefault();
					selectOption(activeOption);
				}
				break;
			case "Escape":
				event.preventDefault();
				setIsOpen(false);
				setHighlightedIndex(0);
				break;
		}
	};

	return (
		<div ref={containerRef} className={cn("relative", className)}>
			{label ? (
				<label
					htmlFor={inputId}
					className="mb-1.5 block text-xs text-muted-foreground"
				>
					{label}
				</label>
			) : null}
			<div
				className={cn(
					"relative rounded-xl border border-border/70 bg-background transition-[border-color,box-shadow,border-radius] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
					isOpen && "rounded-b-none border-foreground/30 shadow-sm",
					disabled && "opacity-70",
				)}
			>
				{leadingIcon ? (
					<span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-muted-foreground">
						{leadingIcon}
					</span>
				) : null}
				<input
					ref={inputRef}
					id={inputId}
					type="text"
					role="combobox"
					aria-autocomplete="list"
					aria-controls={listboxId}
					aria-expanded={isOpen}
					aria-activedescendant={activeOptionId}
					aria-label={label ?? placeholder}
					value={inputValue}
					disabled={disabled}
					placeholder={placeholder}
					autoComplete="off"
					onFocus={open}
					onChange={(event) => updateInputValue(event.target.value)}
					onKeyDown={handleKeyDown}
					className={cn(
						"h-11 w-full rounded-xl bg-transparent pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
						trailingAdornment && "pr-16",
						isOpen && "rounded-b-none",
					)}
				/>
				{trailingAdornment ? (
					<span className="pointer-events-none absolute top-1/2 right-3 z-10 -translate-y-1/2">
						{trailingAdornment}
					</span>
				) : null}
				{isOpen ? (
					<div className="absolute right-[-1px] left-[-1px] top-[calc(100%-1px)] z-40 overflow-hidden rounded-b-xl border border-t-0 border-border/80 bg-card opacity-100 shadow-[0_18px_52px_-34px_rgba(20,20,20,0.75)] animate-in fade-in-0 zoom-in-95 duration-200">
						<ul
							id={listboxId}
							role="listbox"
							aria-label={label ?? "Suggestions"}
							className="max-h-72 overflow-y-auto py-1"
						>
							{filteredOptions.map((option, index) => {
								const highlighted = index === activeIndex;
								return (
									<li
										key={option.value}
										id={`${listboxId}-option-${index}`}
										role="option"
										aria-selected={highlighted}
										aria-disabled={option.disabled}
										onMouseEnter={() => setHighlightedIndex(index)}
										onMouseDown={(event) => {
											event.preventDefault();
											selectOption(option);
										}}
										className={cn(
											"flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm transition-colors",
											highlighted && "bg-muted",
											option.disabled &&
												"cursor-not-allowed text-muted-foreground opacity-70",
										)}
									>
										<span className="min-w-0">
											<span className="block truncate">{option.label}</span>
											{option.description ? (
												<span className="mt-0.5 block truncate text-xs text-muted-foreground">
													{option.description}
												</span>
											) : null}
										</span>
										{option.rightLabel ? (
											<span className="shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-xs text-muted-foreground">
												{option.rightLabel}
											</span>
										) : null}
										{option.disabled ? (
											<Check className="h-4 w-4 shrink-0 text-muted-foreground" />
										) : null}
									</li>
								);
							})}
							{filteredOptions.length === 0 ? (
								<li className="px-3 py-4 text-center text-sm text-muted-foreground">
									{emptyMessage}
								</li>
							) : null}
							{hiddenMatchCount > 0 ? (
								<li className="border-t border-border/70 px-3 py-2 text-center text-xs text-muted-foreground">
									Type to narrow {hiddenMatchCount} more
								</li>
							) : null}
						</ul>
					</div>
				) : null}
			</div>
		</div>
	);
}
