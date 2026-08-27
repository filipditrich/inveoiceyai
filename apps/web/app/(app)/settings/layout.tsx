import { requireSession } from "@/lib/auth/session";

/**
 * Shared width shell only. The page header and the side nav belong to the
 * scoped layouts (`account/`, `workspace/`) so each door says whose settings
 * you are looking at.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      {children}
    </div>
  );
}
