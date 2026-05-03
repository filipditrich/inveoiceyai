export default function DashboardPage() {
  return (
    <div className="border-border bg-card text-card-foreground space-y-2 rounded-xl border p-8 shadow-sm">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Overview</p>
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground max-w-xl text-[0.9375rem] leading-relaxed">
        Invoicey admin shell — workspace packages resolve from{" "}
        <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">@invoicey/*</code>.
      </p>
    </div>
  );
}
