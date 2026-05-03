import Link from "next/link";

export default function InvoicesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Invoices</h1>
      <p className="text-muted-foreground">
        Builder ships in Plan 6. Until then you can demo PDF rendering from JSON:{" "}
        <Link href="/invoices/from-json" className="text-primary underline underline-offset-4">
          Invoice from JSON
        </Link>
        .
      </p>
    </div>
  );
}
