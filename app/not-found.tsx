import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Search, MapPin } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
						<MapPin className="h-8 w-8 text-orange-600 dark:text-orange-400" />
					</div>
					<CardTitle className="text-3xl font-bold">404</CardTitle>
					<p className="text-lg text-muted-foreground">Page Not Found</p>
				</CardHeader>
				<CardContent className="space-y-6 text-center">
					<p className="text-muted-foreground">
						Looks like you've wandered off the music map! The page you're
						looking for doesn't exist or has been moved.
					</p>

					<div className="flex flex-col sm:flex-row gap-3 justify-center">
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

					<div className="text-sm text-muted-foreground">
						Ready to discover music events across Paris? Head back to the main
						map and explore what's happening during Fête de la Musique 2025.
					</div>
				</CardContent>
			</Card>
		</div>
	);
} 