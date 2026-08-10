"use client";

import { ThemeModeSwitcher } from "@/components/theme-toggle";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function SettingsPage() {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
				<p className="text-muted-foreground text-sm">
					Workspace prefs expand with auth later. Appearance is available now.
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Appearance</CardTitle>
					<CardDescription>
						Light, dark, or match the system. Preference is saved in this browser.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ThemeModeSwitcher className="max-w-xs" />
				</CardContent>
			</Card>
		</div>
	);
}
