"use client";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const THEME_OPTIONS = [
	{ value: "light", label: "Light", icon: SunIcon },
	{ value: "dark", label: "Dark", icon: MoonIcon },
	{ value: "system", label: "System", icon: MonitorIcon },
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];

function subscribe() {
	return () => {};
}

function useIsClient() {
	return useSyncExternalStore(subscribe, () => true, () => false);
}

type ThemeToggleProps = {
	readonly className?: string;
	readonly align?: "start" | "center" | "end";
};

/**
 * Light / dark / system switcher. Preference is stored by next-themes in localStorage.
 */
export function ThemeToggle({ className, align = "end" }: ThemeToggleProps) {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const mounted = useIsClient();

	const current = (theme ?? "system") as ThemeValue;
	const resolvedIsDark = resolvedTheme === "dark";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label="Toggle theme"
						className={cn(className)}
						size="icon-sm"
						title="Theme"
						variant="ghost"
					/>
				}
			>
				{!mounted ? (
					<SunIcon className="size-4 opacity-50" />
				) : resolvedIsDark ? (
					<MoonIcon className="size-4" />
				) : (
					<SunIcon className="size-4" />
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align={align} className="min-w-40" sideOffset={6}>
				<DropdownMenuLabel>Appearance</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup
					value={current}
					onValueChange={(value) => {
						if (
							value === "light" ||
							value === "dark" ||
							value === "system"
						) {
							setTheme(value);
						}
					}}
				>
					{THEME_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							<option.icon />
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

type ThemeModeSwitcherProps = {
	readonly className?: string;
};

/**
 * Compact three-way control for the sidebar footer.
 */
export function ThemeModeSwitcher({ className }: ThemeModeSwitcherProps) {
	const { theme, setTheme } = useTheme();
	const mounted = useIsClient();
	const current = mounted ? (theme ?? "system") : "system";

	return (
		<div
			className={cn(
				"bg-sidebar-accent/50 flex items-center gap-0.5 rounded-xl p-1 ring-1 ring-sidebar-border/80",
				className,
			)}
			role="group"
			aria-label="Theme"
		>
			{THEME_OPTIONS.map((option) => {
				const selected = current === option.value;
				return (
					<button
						key={option.value}
						type="button"
						aria-label={option.label}
						aria-pressed={selected}
						title={option.label}
						className={cn(
							"text-muted-foreground hover:text-sidebar-foreground flex flex-1 items-center justify-center rounded-lg px-2 py-1.5 transition-colors",
							selected &&
								"bg-background text-sidebar-foreground shadow-sm ring-1 ring-sidebar-border",
						)}
						onClick={() => setTheme(option.value)}
					>
						<option.icon className="size-3.5" />
					</button>
				);
			})}
		</div>
	);
}
