import { requirePlatformAdmin, requireSession } from "@/lib/auth/session";

import { AdminShell } from "./admin-shell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireSession();
  await requirePlatformAdmin();

  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        avatar: user.image ?? "",
      }}
    >
      {children}
    </AdminShell>
  );
}
