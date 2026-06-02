"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const getSafeReturnPath = () => {
	const params = new URLSearchParams(window.location.search);
	const returnTo = params.get("returnTo");
	if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
		return "/";
	}
	return returnTo;
};

export function TermsBackLink() {
	const [href, setHref] = useState("/");

	useEffect(() => {
		setHref(getSafeReturnPath());
	}, []);

	return (
		<Link
			href={href}
			className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft className="h-4 w-4" />
			{href.startsWith("/exchange") || href.startsWith("/tickets")
				? "Back to Ticket Exchange"
				: "Back to Events"}
		</Link>
	);
}
