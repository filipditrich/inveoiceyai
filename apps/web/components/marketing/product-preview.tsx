import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  Clock3Icon,
  FileTextIcon,
} from "lucide-react";

const INVOICES = [
  {
    client: "Studio Sever",
    number: "2026-0047",
    amount: "42 350 Kč",
    status: "Zaplaceno",
    tone: "paid",
  },
  {
    client: "Ateliér 21",
    number: "2026-0046",
    amount: "18 150 Kč",
    status: "Čeká na úhradu",
    tone: "open",
  },
  {
    client: "Kavárna Místo",
    number: "2026-0045",
    amount: "9 680 Kč",
    status: "Po splatnosti",
    tone: "overdue",
  },
] as const;

export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
      <div className="from-brand/20 bg-radial absolute -inset-8 -z-10 rounded-[3rem] to-transparent blur-2xl" />
      <div className="bg-card shadow-foreground/8 ring-foreground/5 overflow-hidden rounded-[1.65rem] border shadow-2xl ring-1">
        <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ef8b70]" />
          <span className="size-2.5 rounded-full bg-[#e9c46a]" />
          <span className="size-2.5 rounded-full bg-[#79b48a]" />
          <span className="text-muted-foreground ml-2 text-[0.65rem] font-medium tracking-wide">
            invoicey.ditrich.me/dashboard
          </span>
        </div>

        <div className="grid min-h-[29rem] grid-cols-[4.5rem_1fr] sm:grid-cols-[10rem_1fr]">
          <aside className="bg-sidebar border-r p-3">
            <div className="flex items-center gap-2 px-1 py-2">
              <div className="bg-brand text-brand-foreground grid size-7 place-items-center rounded-lg text-xs font-bold">
                I
              </div>
              <span className="hidden text-xs font-semibold sm:block">
                Invoicey
              </span>
            </div>
            <div className="mt-5 space-y-1.5">
              {["Přehled", "Faktury", "Klienti", "Dodavatelé"].map(
                (item, index) => (
                  <div
                    key={item}
                    className={
                      index === 0
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs flex items-center gap-2 rounded-lg px-2 py-2 text-[0.68rem] font-medium"
                        : "text-muted-foreground flex items-center gap-2 rounded-lg px-2 py-2 text-[0.68rem]"
                    }
                  >
                    {index === 0 ? (
                      <span className="bg-brand h-3.5 w-0.5 rounded-full" />
                    ) : (
                      <span className="size-0.5 rounded-full bg-current" />
                    )}
                    <span className="hidden sm:block">{item}</span>
                  </div>
                ),
              )}
            </div>
          </aside>

          <div className="bg-background min-w-0 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[0.65rem]">Přehled</p>
                <p className="mt-1 text-sm font-semibold">Dobré odpoledne</p>
              </div>
              <div className="bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 text-[0.65rem] font-medium shadow-sm">
                + Nová faktura
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <Metric
                icon={<ArrowUpRightIcon />}
                label="Uhrazeno"
                value="126 400 Kč"
                accent="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
              />
              <Metric
                icon={<Clock3Icon />}
                label="K úhradě"
                value="64 850 Kč"
                accent="bg-brand/15 text-foreground"
              />
              <Metric
                icon={<ArrowDownRightIcon />}
                label="Po splatnosti"
                value="9 680 Kč"
                accent="bg-destructive/10 text-destructive"
              />
            </div>

            <div className="bg-card mt-4 overflow-hidden rounded-xl border">
              <div className="flex items-center justify-between border-b px-3 py-3">
                <div>
                  <p className="text-xs font-medium">Poslední faktury</p>
                  <p className="text-muted-foreground mt-0.5 text-[0.6rem]">
                    Aktuální stav napříč firmami
                  </p>
                </div>
                <FileTextIcon className="text-muted-foreground size-3.5" />
              </div>
              <div className="divide-y">
                {INVOICES.map((invoice) => (
                  <div
                    key={invoice.number}
                    className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 sm:grid-cols-[1fr_7rem_6.5rem] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.7rem] font-medium">
                        {invoice.client}
                      </p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-[0.58rem]">
                        {invoice.number}
                      </p>
                    </div>
                    <p className="text-right text-[0.68rem] font-semibold tabular-nums sm:text-left">
                      {invoice.amount}
                    </p>
                    <Status tone={invoice.tone}>{invoice.status}</Status>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted/35 mt-4 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5">
              <span className="bg-brand/15 grid size-7 place-items-center rounded-lg">
                <CheckIcon className="size-3.5" />
              </span>
              <div>
                <p className="text-[0.68rem] font-medium">
                  PDF + ISDOC připraveny
                </p>
                <p className="text-muted-foreground text-[0.58rem]">
                  Jedna validovaná faktura, dva výstupy
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  accent,
  icon,
  label,
  value,
}: Readonly<{
  accent: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}>) {
  return (
    <div className="bg-card shadow-xs rounded-xl border p-3">
      <div
        className={`grid size-6 place-items-center rounded-lg [&_svg]:size-3 ${accent}`}
      >
        {icon}
      </div>
      <p className="text-muted-foreground mt-3 text-[0.58rem]">{label}</p>
      <p className="mt-0.5 text-[0.7rem] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Status({
  children,
  tone,
}: Readonly<{
  children: React.ReactNode;
  tone: "paid" | "open" | "overdue";
}>) {
  const className = {
    paid: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    open: "bg-brand/15 text-foreground",
    overdue: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <span
      className={`${className} col-span-2 w-fit rounded-full px-2 py-1 text-[0.55rem] font-medium sm:col-span-1`}
    >
      {children}
    </span>
  );
}
