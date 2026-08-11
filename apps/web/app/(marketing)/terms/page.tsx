import type { Metadata } from "next";

import { LegalDocument } from "@/components/marketing/legal-document";

export const metadata: Metadata = {
  title: "Podmínky používání",
  description: "Podmínky používání Invoicey v průběhu neveřejné beta verze.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Právní informace"
      title="Podmínky používání"
      description="Pravidla pro používání aktuální beta verze Invoicey a rozdělení odpovědnosti mezi službu a uživatele."
    >
      <aside>
        <strong>Neveřejná beta verze.</strong> Tyto podmínky jsou pracovní verzí
        pro omezený beta provoz. Identifikace provozovatele, placené tarify,
        úroveň podpory a komerční podmínky budou doplněny před veřejným
        spuštěním.
      </aside>

      <h2>1. Služba</h2>
      <p>
        Invoicey je nástroj pro přípravu, správu, import, vykreslení a odesílání
        fakturačních dokladů. Některé funkce mohou být dostupné jako beta,
        experiment nebo pouze vybraným uživatelům. Aktuální rozsah služby se
        může během beta provozu měnit.
      </p>

      <h2>2. Účet a přístup</h2>
      <p>
        Přihlášení probíhá přes podporovaného OAuth poskytovatele, aktuálně
        Google nebo GitHub. Uživatel odpovídá za zabezpečení tohoto účtu a za
        činnost osob, které pozve do svého pracovního prostoru. Přístup není
        dovoleno sdílet způsobem, který obchází oprávnění nebo technická omezení
        služby.
      </p>

      <h2>3. Odpovědnost za doklady</h2>
      <p>
        Invoicey provádí technické a schématické kontroly, ale neposkytuje
        účetní, daňové ani právní poradenství. Uživatel odpovídá za pravdivost
        vstupních údajů, volbu daňového režimu, oprávnění doklad vystavit a jeho
        soulad s konkrétním obchodním případem. Před vydáním má uživatel doklad
        zkontrolovat.
      </p>

      <h2>4. Agentní a automatizované funkce</h2>
      <p>
        AI může připravit návrh nebo navrhnout další krok. Výstup může být
        neúplný nebo chybný a musí projít stejnou validací a lidskou kontrolou
        jako ručně zadané údaje. Uživatel nesmí automatizaci využít k podvodu,
        vydávání dokladů bez oprávnění nebo jinému protiprávnímu jednání.
      </p>

      <h2>5. Data a soubory</h2>
      <p>
        Uživatel si ponechává práva ke svým údajům a souborům a uděluje Invoicey
        oprávnění zpracovat je pouze pro poskytnutí služby. Uživatel musí mít
        právo zpracovávat osobní a obchodní údaje, které do služby vloží.
        Důležité doklady je vhodné uchovávat také ve vlastním archivu.
      </p>

      <h2>6. Dostupnost a změny</h2>
      <p>
        Beta verze je poskytována bez záruky nepřetržité dostupnosti. Služba
        může být změněna, dočasně omezena nebo ukončena, zejména kvůli údržbě,
        bezpečnosti nebo změnám dodavatelů. Pokud to okolnosti dovolí, významnou
        změnu oznámíme přiměřeným způsobem.
      </p>

      <h2>7. Zakázané použití</h2>
      <p>
        Službu nelze používat k porušování právních předpisů, zasílání spamu,
        neoprávněnému přístupu, obcházení zabezpečení, šíření škodlivého kódu
        nebo vytěžování služby způsobem, který ji nepřiměřeně zatěžuje.
      </p>

      <h2>8. Omezení odpovědnosti</h2>
      <p>
        V rozsahu dovoleném právem neodpovídá beta služba za nepřímou škodu,
        ušlý zisk ani důsledky rozhodnutí založených na nezkontrolovaném
        automatizovaném výstupu. Tím nejsou dotčena práva, která podle zákona
        nelze smluvně omezit.
      </p>

      <h2>9. Změny podmínek</h2>
      <p>
        Podmínky mohou být upraveny spolu s vývojem služby. Nová verze bude
        zveřejněna zde s datem aktualizace. Pokračování v používání po účinnosti
        změny znamená přijetí aktualizovaných podmínek, pokud právní předpis
        nevyžaduje jiný postup.
      </p>
    </LegalDocument>
  );
}
