import { ArrowRightIcon, CheckIcon, MessageSquareTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function ChatgptShowcase({
  setupHref = "/chatgpt",
}: {
  setupHref?: string;
}) {
  const t = await getTranslations("Marketing.chatgpt");
  return (
    <section
      id="chatgpt"
      className="scroll-mt-24 border-y bg-muted/20 px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
            <MessageSquareTextIcon className="size-4" />
            {t("eyebrow")}
          </p>
          <h2 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            {t("description")}
          </p>
          <ul className="mt-7 space-y-3">
            {[t("feature1"), t("feature2"), t("feature3")].map((feature) => (
              <li key={feature} className="flex gap-3">
                <CheckIcon className="mt-1 size-4 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href={setupHref}
            className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            {t("cta")}
            <ArrowRightIcon className="size-4" />
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("availability")}
          </p>
        </div>
        <div className="rounded-[2rem] border bg-background p-5 shadow-xl shadow-primary/5 sm:p-8">
          <p className="mb-5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {t("example")}
          </p>
          <div className="ml-6 rounded-2xl rounded-br-sm bg-muted px-5 py-4 text-sm leading-relaxed">
            {t("prompt")}
          </div>
          <div className="mt-5 rounded-2xl border p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold">Invoicey</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                {t("draft")}
              </span>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">{t("line")}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {t("amount")}
            </p>
            <div className="mt-5 border-t pt-4 text-sm text-muted-foreground">
              {t("review")}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {t("control")}
          </p>
        </div>
      </div>
    </section>
  );
}
