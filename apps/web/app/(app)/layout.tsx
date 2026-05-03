import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/clients", label: "Clients" },
  { href: "/issuers", label: "Issuers" },
  { href: "/settings", label: "Settings" },
];

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex w-60 flex-col border-r px-4 py-6">
        <div className="text-sidebar-foreground mb-8 text-lg font-semibold tracking-tight">Invoicey</div>
        <nav className="flex flex-col gap-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-3 py-2 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
