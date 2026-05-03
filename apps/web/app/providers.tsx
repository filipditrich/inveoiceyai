"use client";

import type { PropsWithChildren } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";

export default function Providers({ children }: PropsWithChildren) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
			enableSystem
		>
			<TooltipProvider delay={0}>
				{children}
				<Toaster position="bottom-right" />
			</TooltipProvider>
		</ThemeProvider>
	);
}
