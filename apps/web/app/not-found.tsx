import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[65svh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-primary font-mono text-sm font-semibold">404</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          Tahle stránka na faktuře není.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-lg leading-relaxed">
          Odkaz mohl zastarat nebo stránka změnila adresu. Veřejný přehled
          produktu najdete na úvodní stránce.
        </p>
        <Button className="mt-8" render={<Link href="/" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Zpět na Invoicey
        </Button>
      </div>
    </MarketingShell>
  );
}
