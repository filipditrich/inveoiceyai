import { requireSession } from "@/lib/auth/session";

import { AppShell } from "./app-shell";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Redirects signed-out users. Individual pages still call
  // `requireWorkspace()` themselves — a layout is not an authorization
  // boundary, since route handlers and actions do not pass through it.
  const user = await requireSession();

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        avatar: user.image ?? "",
      }}
    >
      {children}
    </AppShell>
  );
}
