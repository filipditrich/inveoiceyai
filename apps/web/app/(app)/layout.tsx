import { AppSidebar } from "./app-sidebar";

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <AppSidebar />
      <main className="flex flex-1 flex-col overflow-auto bg-gradient-to-b from-background to-muted/15">
        <div className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
