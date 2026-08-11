import type { Metadata } from "next";

import { LegalDocument } from "@/components/marketing/legal-document";
import { Button } from "@/components/ui/button";
import { C15tSettingsLink } from "@/features/c15t";

export const metadata: Metadata = {
  title: "Používání cookies",
  description:
    "Jaké cookies a lokální úložiště Invoicey používá a jak změnit volbu.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalDocument
      eyebrow="Právní informace"
      title="Používání cookies"
      description="Dvě srozumitelné kategorie. Nezbytné technologie pro provoz a volitelné anonymní měření. Žádné reklamní cookies."
    >
      <div className="not-prose bg-card shadow-xs mb-10 rounded-2xl border p-5">
        <p className="text-sm font-medium">Chcete změnit svou volbu?</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Nastavení otevřete kdykoliv. Odvolání analytického souhlasu se projeví
          bez dalšího sledování.
        </p>
        <Button className="mt-4" render={<C15tSettingsLink />}>
          Otevřít nastavení cookies
        </Button>
      </div>

      <h2>1. Nezbytné technologie</h2>
      <p>
        Tyto technologie nelze vypnout, protože zajišťují přihlášení,
        zabezpečení relace, oddělení pracovního prostoru a zapamatování vaší
        volby soukromí. Patří sem zejména bezpečné cookies Better Auth a záznam
        <code>c15t-consent</code>, který uchovává vaši volbu nejdéle jeden rok.
        Rozhraní může v lokálním úložišti ukládat také čistě funkční preference,
        například motiv vzhledu.
      </p>

      <h2>2. Anonymní měření</h2>
      <p>
        Po vašem souhlasu načteme Vercel Analytics. Poskytuje souhrnné informace
        o návštěvnosti a výkonu veřejných stránek. Nepoužíváme je k reklamnímu
        profilování ani je nekombinujeme s fakturačním obsahem. Bez souhlasu se
        analytická komponenta nenačte.
      </p>

      <h2>3. Co nepoužíváme</h2>
      <p>
        Invoicey v současnosti nepoužívá reklamní sítě, remarketingové pixely
        ani cookies pro sledování napříč weby. Pokud by se to změnilo, tato
        stránka i volby souhlasu budou aktualizovány před jejich zapnutím.
      </p>

      <h2>4. Změna nebo odvolání souhlasu</h2>
      <p>
        Nastavení můžete otevřít tlačítkem výše nebo odkazem „Nastavení cookies“
        v patičce. Volba „Pouze nezbytné“ odmítne nebo odvolá měření. Vymazání
        dat webu v prohlížeči odstraní i uloženou volbu a při příští návštěvě se
        zeptáme znovu.
      </p>
    </LegalDocument>
  );
}
