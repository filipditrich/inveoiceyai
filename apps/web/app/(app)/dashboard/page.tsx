import { invoiceCorePlaceholder } from "@invoicey/invoice-core";

export default function DashboardPage() {
  void invoiceCorePlaceholder;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Invoicey admin shell — workspace packages resolve from `@invoicey/*`.
      </p>
    </div>
  );
}
