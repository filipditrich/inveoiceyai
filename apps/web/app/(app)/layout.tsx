import { AppShell } from "./app-shell";

export default function AppShellLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <AppShell>{children}</AppShell>;
}
