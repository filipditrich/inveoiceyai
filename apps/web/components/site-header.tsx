"use client";

import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

const SEGMENT_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	invoices: "Invoices",
	clients: "Clients",
	issuers: "Issuers",
	settings: "Settings",
	"from-json": "From JSON",
	new: "New",
	edit: "Edit",
};

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelForSegment(segment: string, parent?: string): string {
	if (SEGMENT_LABELS[segment]) {
		return SEGMENT_LABELS[segment];
	}
	if (UUID_RE.test(segment)) {
		if (parent === "invoices") {
			return "Invoice";
		}
		if (parent === "issuers") {
			return "Issuer";
		}
		if (parent === "clients") {
			return "Client";
		}
		return "Detail";
	}
	return segment;
}

export function SiteHeader() {
	const pathname = usePathname();

	const segments = pathname.split("/").filter(Boolean);

	const crumbs: { readonly href: string; readonly label: string }[] = [
		{ href: "/dashboard", label: "Invoicey" },
	];
	let acc = "";
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]!;
		acc += `/${segment}`;
		crumbs.push({
			href: acc,
			label: labelForSegment(segment, segments[i - 1]),
		});
	}

	const lastIndex = crumbs.length - 1;

	return (
		<header className="bg-background/80 sticky top-0 z-50 flex w-full shrink-0 border-b backdrop-blur-md">
			<div className="flex h-(--header-height) w-full items-center gap-2 px-4 transition-[height] duration-200 ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
				<SidebarTrigger
					aria-label="Toggle sidebar"
					className="-ml-1"
					title="⌘ / Ctrl+B"
				/>
				<Separator
					className="mr-2 data-vertical:h-4 data-vertical:self-center"
					orientation="vertical"
				/>
				<Breadcrumb className="mr-auto hidden min-w-0 flex-1 sm:flex">
					<BreadcrumbList className="min-w-0">
						{crumbs.map((crumb, index) => (
							<Fragment key={`${index}:${crumb.href}`}>
								<BreadcrumbItem className="min-w-0">
									{index === lastIndex ? (
										<BreadcrumbPage className="truncate font-normal">
											{crumb.label}
										</BreadcrumbPage>
									) : (
										<BreadcrumbLink render={<Link prefetch href={crumb.href} />}>
											<span className="truncate">{crumb.label}</span>
										</BreadcrumbLink>
									)}
								</BreadcrumbItem>
								{index < lastIndex ? <BreadcrumbSeparator /> : null}
							</Fragment>
						))}
					</BreadcrumbList>
				</Breadcrumb>
				<div className="flex items-center gap-1.5">
					<SearchForm className="w-full sm:max-w-xs" />
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
