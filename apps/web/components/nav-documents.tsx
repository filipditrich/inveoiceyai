"use client"

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar"
import { MoreHorizontalIcon, ShareIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function NavDocuments({
	items,
}: {
	items: { name: string; url: string; icon: LucideIcon }[]
}) {
	const { isMobile } = useSidebar()
	const router = useRouter()

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Documents</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					const Icon = item.icon
					return (
						<DropdownMenu key={item.name}>
							<SidebarMenuItem>
								<SidebarMenuButton render={<Link prefetch href={item.url} />}>
									<Icon />
									<span>{item.name}</span>
								</SidebarMenuButton>
								<DropdownMenuTrigger
									render={
										<SidebarMenuAction showOnHover title="More">
											<MoreHorizontalIcon />
											<span className="sr-only">More</span>
										</SidebarMenuAction>
									}
								/>
								<DropdownMenuContent
									className="w-40 rounded-lg"
									side={isMobile ? "bottom" : "right"}
									align={isMobile ? "end" : "start"}
								>
									<DropdownMenuItem onClick={() => router.push(item.url)}>
										Open
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() => {
											const href = item.url.startsWith("http")
												? item.url
												: `${window.location.origin}${item.url}`
											void navigator.clipboard.writeText(href)
										}}
									>
										<ShareIcon />
										Copy link
									</DropdownMenuItem>
								</DropdownMenuContent>
							</SidebarMenuItem>
						</DropdownMenu>
					)
				})}
			</SidebarMenu>
		</SidebarGroup>
	)
}
