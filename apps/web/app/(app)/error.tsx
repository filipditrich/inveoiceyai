"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function AppError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[app error]", error);
	}, [error]);

	return (
		<div className="flex flex-1 flex-col items-start gap-4 px-4 py-10 lg:px-6">
			<h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
			<p className="text-muted-foreground max-w-lg text-sm">
				{error.message || "An unexpected error occurred."}
				{error.digest ? ` (ref ${error.digest})` : null}
			</p>
			<div className="flex gap-2">
				<Button onClick={() => reset()} size="sm" type="button">
					Try again
				</Button>
				<Button
					render={<a href="/dashboard" />}
					size="sm"
					type="button"
					variant="outline"
				>
					Back to dashboard
				</Button>
			</div>
		</div>
	);
}
