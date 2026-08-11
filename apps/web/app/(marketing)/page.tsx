import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BotIcon,
  Building2Icon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  DatabaseIcon,
  FileArchiveIcon,
  FileCheck2Icon,
  LandmarkIcon,
  MailCheckIcon,
  MessageSquareTextIcon,
  QrCodeIcon,
  SearchCheckIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";

import { ProductPreview } from "@/components/marketing/product-preview";
import motionStyles from "@/components/marketing/marketing-motion.module.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "České faktury bez zbytečného klikání",
  description:
    "Invoicey propojuje českou fakturaci, PDF, ISDOC, SPAYD QR a ARES s moderním webem a AI automatizací.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Invoicey — české faktury bez zbytečného klikání",
    description:
      "Jedna validovaná faktura. Web, PDF, ISDOC, QR i AI automatizace.",
    url: "/",
  },
};

const TRUST_ITEMS = [
  { icon: FileCheck2Icon, label: "PDF + ISDOC" },
  { icon: QrCodeIcon, label: "SPAYD QR platba" },
  { icon: SearchCheckIcon, label: "ARES podle IČO" },
  { icon: Building2Icon, label: "Více dodavatelů" },
] as const;

const CAPABILITIES = [
  {
    icon: FileCheck2Icon,
    title: "České doklady bez slepých míst",
    description:
      "Faktury, zálohy, proformy i dobropisy. DPH, DUZP, symboly, QR platba a ISDOC jsou součást stejného výstupu.",
  },
  {
    icon: Building2Icon,
    title: "Každá firma má vlastní pravidla",
    description:
      "Bankovní účet, číselná řada, plátcovství DPH i vizuální prvky zůstávají u správného dodavatele.",
  },
  {
    icon: MailCheckIcon,
    title: "Od vystavení po úhradu",
    description:
      "Odešlete PDF a ISDOC, sledujte doručení, splatnost a úhradu bez přepisování stavu mezi několika nástroji.",
  },
  {
    icon: FileArchiveIcon,
    title: "Historie zůstává historií",
    description:
      "Vydané doklady jsou neměnné. Starší PDF a ISDOC můžete importovat a zachovat jejich původ i přesnou podobu.",
  },
  {
    icon: DatabaseIcon,
    title: "Data jsou první, PDF až druhé",
    description:
      "Jedno validační schéma pohání web, JSON i nástroje pro agenty. Výsledek se nemění podle toho, odkud faktura vznikla.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Oddělené pracovní prostory",
    description:
      "OAuth přihlášení přes Google nebo GitHub a kontrola členství pracovního prostoru na každé serverové hranici.",
  },
] as const;

const FAQ = [
  {
    question: "Je Invoicey určené jen pro plátce DPH?",
    answer:
      "Ne. Podporuje plátce i neplátce, běžný režim DPH, přenesenou daňovou povinnost a další údaje českých dokladů.",
  },
  {
    question: "Můžu fakturovat z více firem nebo živností?",
    answer:
      "Ano. Každý dodavatel má vlastní banku, číselné řady, DPH nastavení, logo i kontaktní údaje. Klienti přitom zůstávají sdílení v jednom pracovním prostoru.",
  },
  {
    question: "Co znamená AI fakturace?",
    answer:
      "Agent neskládá PDF od oka. Připraví strukturovaný návrh, který projde stejnou validací jako faktura vytvořená ve webu. Vydání nebo odeslání citlivého dokladu zůstává potvrzovaná akce.",
  },
  {
    question: "Lze přenést staré faktury?",
    answer:
      "Ano. Hromadný import přijímá PDF a ISDOC. Pokud PDF obsahuje vložený ISDOC, Invoicey načte i strukturovaná data; jinak zachová originál jako archivní doklad.",
  },
  {
    question: "Je Invoicey účetní nebo daňové poradenství?",
    answer:
      "Ne. Invoicey pomáhá připravit a spravovat doklady, ale správnost konkrétního obchodního a daňového případu vždy odpovídá uživateli a jeho účetnímu či daňovému poradci.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="marketing-grid absolute inset-0 -z-20 opacity-55" />
        <div className="bg-brand/20 absolute -top-48 left-1/2 -z-10 size-[38rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8 lg:pt-28">
          <div className={`${motionStyles.heroCopy} max-w-2xl`}>
            <Badge
              variant="outline"
              className="bg-background/70 h-7 gap-1.5 px-3 backdrop-blur"
            >
              <SparklesIcon data-icon="inline-start" />
              České faktury, připravené i pro AI
            </Badge>
            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
              Fakturace, která začíná daty.
              <span className="text-primary block">Ne formulářem.</span>
            </h1>
            <p className="text-muted-foreground mt-7 max-w-xl text-pretty text-lg leading-relaxed sm:text-xl">
              Vystavujte správné české doklady ve webu, z JSONu nebo přes AI.
              Invoicey je pokaždé ověří a vytvoří stejné PDF, ISDOC i platební
              QR.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="shadow-primary/15 h-11 px-5 text-[0.95rem] shadow-lg"
                render={<Link href="/dashboard" prefetch={false} />}
              >
                Otevřít Invoicey
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-5 text-[0.95rem]"
                render={<Link href="#jak-to-funguje" />}
              >
                Jak to funguje
              </Button>
            </div>
            <div className="text-muted-foreground mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-3.5" /> Bez hesla
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-3.5" /> České
                rozhraní
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-3.5" /> Beta
                přístup
              </span>
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section aria-label="Klíčové formáty" className="bg-muted/25 border-y">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`${motionStyles.trustItem} md:border-border/60 flex items-center justify-center gap-2.5 border-x border-transparent px-3 py-5 text-sm font-medium`}
            >
              <item.icon className="text-primary size-4" />
              {item.label}
            </div>
          ))}
        </div>
      </section>

      <section
        id="jak-to-funguje"
        className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="Od zadání po zaplacení"
            title="Méně ruční práce. Pořád máte kontrolu."
            description="Invoicey drží celý životní cyklus dokladu pohromadě a citlivé kroky nechává ve vašich rukou."
          />
          <div
            className={`${motionStyles.scrollReveal} mt-14 grid gap-5 lg:grid-cols-3`}
          >
            <WorkflowStep
              number="01"
              icon={<SearchCheckIcon />}
              title="Připravte údaje"
              description="Vyberte dodavatele, dohledejte klienta podle IČO a doplňte položky. Nebo pošlete stejná data jako JSON či pokyn agentovi."
            />
            <WorkflowStep
              number="02"
              icon={<FileCheck2Icon />}
              title="Ověřte a vystavte"
              description="Jedno schéma zkontroluje povinné údaje, DPH i součty. Teprve potom vznikne neměnný doklad, PDF, ISDOC a QR."
            />
            <WorkflowStep
              number="03"
              icon={<SendIcon />}
              title="Odešlete a sledujte"
              description="Pošlete fakturu klientovi, sledujte doručení a splatnost a označte úhradu ve stejném přehledu."
            />
          </div>
        </div>
      </section>

      <section
        id="prehled"
        className="bg-muted/25 scroll-mt-24 border-y px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow="České účetní reálie"
            title="To podstatné je součást základu."
            description="Ne další vrstva kolem generátoru PDF. Invoicey staví na údajích, které český doklad skutečně potřebuje."
          />
          <div
            className={`${motionStyles.scrollReveal} bg-border mt-14 grid gap-px overflow-hidden rounded-3xl border md:grid-cols-2 lg:grid-cols-3`}
          >
            {CAPABILITIES.map((capability) => (
              <div
                key={capability.title}
                className={`${motionStyles.liftCard} bg-background p-6 sm:p-8`}
              >
                <span className="bg-brand/12 grid size-10 place-items-center rounded-xl">
                  <capability.icon className="size-4.5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">
                  {capability.title}
                </h3>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {capability.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="automatizace"
        className="scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className={motionStyles.scrollReveal}>
            <Badge variant="secondary" className="h-7 gap-1.5 px-3">
              <BotIcon data-icon="inline-start" /> Automatizace · beta
            </Badge>
            <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Agent připraví návrh. Pravidla rozhodnou, co projde.
            </h2>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
              Slack a MCP používají stejné nástroje jako web. AI může dohledat
              firmu, sestavit návrh a připravit soubory, ale nevymýšlí chybějící
              povinné údaje a potvrzení citlivých akcí zůstává na vás.
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "ARES dohledání podle názvu nebo IČO",
                "Validovaný návrh podle InvoiceSchema",
                "PDF a ISDOC ze stejného renderovacího jádra",
                "Potvrzení před vydáním, odesláním nebo úhradou",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2Icon className="text-primary mt-0.5 size-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`${motionStyles.scrollReveal} ${motionStyles.chatStage} bg-foreground text-background dark:bg-card dark:text-card-foreground relative overflow-hidden rounded-[2rem] p-4 shadow-2xl sm:p-6`}
          >
            <div className="bg-brand/20 absolute -right-20 -top-20 size-64 rounded-full blur-3xl" />
            <div className="dark:border-border dark:bg-background/50 relative rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="dark:border-border flex items-center gap-3 border-b border-white/10 pb-4">
                <span className="bg-brand text-brand-foreground grid size-9 place-items-center rounded-xl">
                  <MessageSquareTextIcon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Invoicey v Slacku</p>
                  <p className="text-background/55 dark:text-muted-foreground text-xs">
                    Strukturovaný návrh, ne volný text
                  </p>
                </div>
              </div>
              <div className="space-y-4 py-5">
                <div className="dark:bg-muted ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-white/10 px-4 py-3 text-sm leading-relaxed">
                  @Invoicey vystav měsíční fakturu pro Studio Sever, 35 000 Kč
                  bez DPH, splatnost 14 dní.
                </div>
                <div className="bg-brand text-brand-foreground max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3 text-sm shadow-lg">
                  <p className="font-medium">Návrh je připravený</p>
                  <div className="bg-black/8 mt-3 space-y-2 rounded-xl p-3 text-xs">
                    <ChatRow
                      label="Klient"
                      value="Studio Sever · ARES ověřeno"
                    />
                    <ChatRow label="Částka" value="35 000 Kč" />
                    <ChatRow label="Výstup" value="PDF + ISDOC + SPAYD" />
                  </div>
                  <div className="bg-foreground text-background mt-3 inline-flex rounded-lg px-3 py-2 text-xs font-semibold">
                    Zkontrolovat a vystavit
                  </div>
                </div>
              </div>
              <div className="text-background/45 dark:border-border dark:text-muted-foreground flex items-center gap-2 border-t border-white/10 pt-4 text-[0.65rem]">
                <LandmarkIcon className="size-3.5" />
                Vydání faktury vždy vyžaduje potvrzení
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/25 border-y px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div
          className={`${motionStyles.scrollReveal} mx-auto grid max-w-7xl gap-5 lg:grid-cols-2`}
        >
          <FeaturePanel
            icon={<Building2Icon />}
            eyebrow="Více dodavatelů"
            title="Živnost a s.r.o. bez přepínacího chaosu."
            description="Vyberete, kdo fakturu vystavuje, a Invoicey použije jeho účet, číselnou řadu, DPH režim a vizuální prvky. Sdílený klient zůstává jeden."
            items={[
              "Vlastní číselné řady",
              "Bankovní údaje a QR",
              "Logo, podpis a razítko",
            ]}
          />
          <FeaturePanel
            icon={<FileArchiveIcon />}
            eyebrow="Historický import"
            title="Začněte dnes, historii nechte beze změny."
            description="Nahrajte starší PDF nebo ISDOC hromadně. Invoicey zachová původní soubory, označí jejich zdroj a nedovolí přepsat vydaný archivní doklad."
            items={[
              "PDF s vloženým ISDOC",
              "Archivní režim bez ISDOC",
              "Původ dokladu a neměnné soubory",
            ]}
          />
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.7fr_1fr] lg:gap-20">
          <SectionIntro
            eyebrow="Časté otázky"
            title="Než otevřete první fakturu."
            description="Stručně a bez produktové omáčky."
            align="left"
          />
          <div className={`${motionStyles.scrollReveal} divide-y border-y`}>
            {FAQ.map((item, index) => (
              <details key={item.question} className="group" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-base font-medium marker:hidden">
                  {item.question}
                  <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-muted-foreground max-w-2xl pb-5 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <div
          className={`${motionStyles.scrollReveal} from-brand/35 via-brand/15 bg-linear-to-br to-background relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border p-8 sm:p-12 lg:p-16`}
        >
          <CircleDollarSignIcon className="text-primary/15 absolute -bottom-12 -right-8 size-64 -rotate-12" />
          <div className="relative max-w-2xl">
            <p className="text-primary text-sm font-semibold uppercase tracking-wide">
              Připraveno k vystavení
            </p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Dejte fakturám jedno místo a jeden zdroj pravdy.
            </h2>
            <p className="text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
              Přihlaste se přes Google nebo GitHub. Heslo u Invoicey vytvářet
              nemusíte.
            </p>
            <Button
              size="lg"
              className="mt-8 h-11 px-5 text-[0.95rem]"
              render={<Link href="/dashboard" prefetch={false} />}
            >
              Otevřít Invoicey
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionIntro({
  align = "center",
  description,
  eyebrow,
  title,
}: Readonly<{
  align?: "center" | "left";
  description: string;
  eyebrow: string;
  title: string;
}>) {
  return (
    <div
      className={`${motionStyles.scrollReveal} ${
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-xl"
      }`}
    >
      <p className="text-primary text-sm font-semibold uppercase tracking-wide">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function WorkflowStep({
  description,
  icon,
  number,
  title,
}: Readonly<{
  description: string;
  icon: React.ReactNode;
  number: string;
  title: string;
}>) {
  return (
    <div
      className={`${motionStyles.liftCard} bg-card shadow-xs relative rounded-3xl border p-6 sm:p-8`}
    >
      <span className="text-muted-foreground/35 absolute right-7 top-6 font-mono text-4xl font-semibold tracking-tighter">
        {number}
      </span>
      <span className="bg-brand/12 grid size-11 place-items-center rounded-2xl [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function ChatRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="opacity-65">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function FeaturePanel({
  description,
  eyebrow,
  icon,
  items,
  title,
}: Readonly<{
  description: string;
  eyebrow: string;
  icon: React.ReactNode;
  items: readonly string[];
  title: string;
}>) {
  return (
    <div
      className={`${motionStyles.liftCard} bg-background rounded-[2rem] border p-7 sm:p-10`}
    >
      <span className="bg-brand/12 grid size-11 place-items-center rounded-2xl [&_svg]:size-5">
        {icon}
      </span>
      <p className="text-primary mt-8 text-xs font-semibold uppercase tracking-wide">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em]">
        {title}
      </h2>
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        {description}
      </p>
      <div className="mt-7 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          >
            <CheckCircle2Icon className="text-primary size-3" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
