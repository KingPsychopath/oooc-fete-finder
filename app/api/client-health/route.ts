import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json(
		{
			ok: true,
			timestamp: new Date().toISOString(),
		},
		{ headers: NO_STORE_HEADERS },
	);
}
