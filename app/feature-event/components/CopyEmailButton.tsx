"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

type CopyEmailButtonProps = {
	email: string;
};

export function CopyEmailButton({ email }: CopyEmailButtonProps) {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(email);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy email:", err);
		}
	};

	return (
		<button
			onClick={copyToClipboard}
			className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors ml-1"
			title="Copy email address"
		>
			<Copy className="h-3 w-3" />
			{copied && <span className="text-xs text-green-600">Copied!</span>}
		</button>
	);
} 