import type { Metadata } from "next";

import { LegalDocument } from "@/components/marketing/legal-document";

export const metadata: Metadata = {
  title: "Ochrana soukromí",
  description:
    "Jak Invoicey pracuje s osobními údaji v průběhu neveřejné beta verze.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Právní informace"
      title="Ochrana soukromí"
      description="Přehled údajů, které Invoicey potřebuje k provozu služby, proč je zpracovává a jaké máte možnosti."
    >
      <aside>
        <strong>Neveřejná beta verze.</strong> Invoicey je nyní poskytováno
        omezenému okruhu uživatelů. Úplné identifikační a kontaktní údaje
        provozovatele budou doplněny před veřejným komerčním spuštěním. Do té
        doby použijte pro požadavky stejný kontaktní kanál, kterým jste získali
        přístup.
      </aside>

      <h2>1. Jaké údaje zpracováváme</h2>
      <p>Podle toho, jak Invoicey používáte, může služba zpracovávat:</p>
      <ul>
        <li>jméno, e-mail a profilový obrázek z Google nebo GitHub účtu,</li>
        <li>členství a roli v pracovním prostoru,</li>
        <li>
          údaje dodavatelů, klientů a faktur, včetně kontaktních údajů,
          bankovních údajů, IČO, DIČ a položek dokladů,
        </li>
        <li>nahrané logo, podpis, razítko a archivní fakturační soubory,</li>
        <li>záznamy o odeslání, doručení a stavu fakturačních e-mailů,</li>
        <li>
          technické bezpečnostní záznamy a, pokud s tím souhlasíte, anonymní
          souhrnné měření návštěvnosti.
        </li>
      </ul>

      <h2>2. Proč údaje používáme</h2>
      <p>Údaje používáme pouze v rozsahu potřebném pro:</p>
      <ul>
        <li>přihlášení, správu účtu a oddělení pracovních prostorů,</li>
        <li>vytvoření, uložení, vykreslení, import a odeslání faktur,</li>
        <li>ochranu služby, diagnostiku chyb a prevenci zneužití,</li>
        <li>splnění zákonných povinností spojených s účetními doklady,</li>
        <li>
          měření výkonu a používání veřejného webu, pouze pokud udělíte souhlas
          s kategorií „Anonymní měření“.
        </li>
      </ul>

      <h2>3. Právní základ</h2>
      <p>
        Provoz účtu a fakturačních funkcí je založen na plnění služby, o kterou
        uživatel požádal. Bezpečnostní a nezbytné provozní záznamy zpracováváme
        na základě oprávněného zájmu na bezpečném provozu. Volitelné měření je
        založeno na souhlasu, který lze kdykoliv změnit.
      </p>

      <h2>4. Dodavatelé služby</h2>
      <p>
        Invoicey používá specializované dodavatele infrastruktury. Podle
        zapnutých funkcí jde zejména o Vercel (hosting a volitelné měření), Neon
        (databáze), UploadThing (soubory), Resend (transakční e-mail),
        Google/GitHub (OAuth přihlášení) a Slack/Vercel Connect pro agentní
        integraci. Tito dodavatelé zpracovávají údaje jen pro zajištění dané
        funkce a podle svých smluvních a bezpečnostních podmínek.
      </p>

      <h2>5. Doba uchování</h2>
      <p>
        Účetní a vystavené doklady mohou podléhat zákonným archivačním
        povinnostem a nejsou automaticky přepisovány při změně živých údajů.
        Ostatní údaje uchováváme po dobu aktivního účtu a následně jen po dobu
        nezbytnou k ochraně služby, řešení nároků nebo splnění právní
        povinnosti. Konkrétní retenční lhůty budou před veřejným spuštěním
        doplněny do této stránky.
      </p>

      <h2>6. Vaše práva</h2>
      <p>
        V mezích GDPR můžete požádat o přístup, opravu, výmaz, omezení
        zpracování, přenositelnost nebo vznést námitku. Souhlas s měřením lze
        odvolat okamžitě přes nastavení cookies. Některé údaje z účetních
        dokladů nemusí být možné vymazat, pokud jejich uchování vyžaduje zákon.
      </p>

      <h2>7. Zabezpečení a změny</h2>
      <p>
        Přístup do aplikace používá OAuth bez vlastního hesla u Invoicey.
        Pracovní data jsou vždy dotazována v kontextu ověřeného členství v
        pracovním prostoru. Žádné internetové službě však nelze slíbit absolutní
        bezpečnost. Tuto stránku upravíme při změně významného způsobu
        zpracování a zveřejníme nové datum aktualizace.
      </p>
    </LegalDocument>
  );
}
