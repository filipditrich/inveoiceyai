import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function InvoicesPage() {
  return (
    <div className="border-border bg-card text-card-foreground space-y-4 rounded-xl border p-8 shadow-sm">
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">Billing</p>
        <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
      </div>
      <p className="text-muted-foreground max-w-xl text-[0.9375rem] leading-relaxed">
        Builder ships in Plan 6. Until then you can demo PDF rendering from JSON.
      </p>
      <Link
        href="/invoices/from-json"
        className={cn(buttonVariants({ variant: "default" }), "inline-flex h-9 px-5 no-underline")}
      >
        Open Invoice from JSON demo
      </Link>
    </div>
  );
}
