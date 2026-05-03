"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<SidebarProvider className="bg-background flex min-h-svh w-full flex-col">
			<SiteHeader />
			<div className="flex min-h-0 flex-1">
				<AppSidebar />
				<SidebarInset className="flex min-h-0 flex-1 flex-col overflow-auto bg-gradient-to-b from-background to-muted/10">
					<div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-5 py-7 lg:px-10 lg:py-10">
						{children}
					</div>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
