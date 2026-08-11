"use client";

import { cn } from "@/lib/utils";

const PDF_VIEW_HASH = "#toolbar=0&navpanes=0&scrollbar=0";

export function InvoicePdfPreview({
	url,
	updating,
	error,
	className,
	emptyLabel = "Vyplň položky pro náhled…",
}: {
	url: string | null;
	updating?: boolean;
	error?: string | null;
	className?: string;
	emptyLabel?: string;
}) {
	const src = url ? `${url}${PDF_VIEW_HASH}` : null;

	return (
		<div className={cn("relative min-h-[70vh] w-full", className)}>
			{updating ? (
				<span className="bg-background/80 text-muted-foreground absolute top-2 right-2 z-10 rounded px-2 py-1 text-xs backdrop-blur">
					Aktualizuji…
				</span>
			) : null}
			{error ? (
				<p className="bg-background/90 text-destructive absolute inset-x-2 top-2 z-10 rounded px-2 py-1 text-xs backdrop-blur">
					{error}
				</p>
			) : null}
			{src ? (
				<iframe
					className="h-[70vh] w-full border-0 bg-transparent"
					data-slot="pdf-frame"
					src={src}
					title="Náhled faktury PDF"
				/>
			) : (
				<div
					className="text-muted-foreground flex h-[70vh] items-center justify-center text-sm"
					data-slot="pdf-frame"
				>
					{emptyLabel}
				</div>
			)}
		</div>
	);
}
