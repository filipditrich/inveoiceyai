"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { CSSProperties, ReactNode } from "react";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "calc(var(--spacing) * 72)",
					"--header-height": "calc(var(--spacing) * 14)",
				} as CSSProperties
			}
		>
			<AppSidebar />
			<SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
				<SiteHeader />
				<ToastFromSearchParams />
				<div className="@container/main flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
					<div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 md:gap-6 md:px-6 md:py-6 lg:px-10">
						{children}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
