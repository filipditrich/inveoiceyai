import {
  CheckIcon,
  FileCheck2Icon,
  LinkIcon,
  QrCodeIcon,
  SmartphoneIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { AppleLogo } from "./apple-logo";

export async function PocketShowcase() {
  const t = await getTranslations("Marketing.pocket");
  const features = [
    { icon: QrCodeIcon, title: t("qrTitle"), description: t("qrDescription") },
    {
      icon: FileCheck2Icon,
      title: t("invoiceTitle"),
      description: t("invoiceDescription"),
    },
    {
      icon: LinkIcon,
      title: t("shareTitle"),
      description: t("shareDescription"),
    },
    {
      icon: CheckIcon,
      title: t("paidTitle"),
      description: t("paidDescription"),
    },
  ];

  return (
    <article
      id="pocket"
      aria-labelledby="pocket-title"
      className="relative mt-14 scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/10 bg-[#101012] text-white shadow-2xl shadow-black/10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 size-[38rem] rounded-full bg-brand/15 blur-3xl"
      />
      <div className="relative grid items-center gap-10 p-7 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 lg:p-14">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Image
              src="/images/pocket/app-icon.png"
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-xl"
            />
            <p className="text-sm font-semibold tracking-wide">{t("name")}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-300">
              <SmartphoneIcon aria-hidden="true" className="size-3" />
              {t("platform")}
            </span>
          </div>
          <h3
            id="pocket-title"
            className="mt-8 max-w-lg text-4xl leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-5xl"
          >
            {t("title")}{" "}
            <span className="text-primary">{t("titleAccent")}</span>
          </h3>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            {t("description")}
          </p>
          <ul className="mt-8 grid gap-x-7 gap-y-6 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-primary"
                  />
                  {title}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {description}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              aria-describedby="pocket-availability"
              className="inline-flex min-h-12 cursor-not-allowed items-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-medium text-zinc-300"
            >
              <AppleLogo aria-hidden="true" className="size-4" />
              {t("testflight")}
            </button>
            <span className="text-xs font-medium text-zinc-400">
              {t("comingSoon")}
            </span>
          </div>
          <p
            id="pocket-availability"
            className="mt-3 max-w-lg text-xs leading-relaxed text-zinc-400"
          >
            {t("availability")}
          </p>
        </div>
        <figure className="relative mx-auto w-full max-w-[360px] px-6 pt-2 pb-6 sm:px-8 lg:pt-4">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-1/4 aspect-square rounded-full border border-white/10 bg-brand/5"
          />
          <div className="relative rotate-3 overflow-hidden rounded-[2.5rem] border-[5px] border-[#303034] bg-black shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
            <Image
              src="/images/pocket/receive.png"
              alt={t("screenshotAlt")}
              width={1320}
              height={2868}
              sizes="(min-width: 640px) 296px, 260px"
              className="h-auto w-full"
            />
          </div>
          <div className="absolute right-0 bottom-24 left-0 flex items-center gap-3 rounded-2xl border border-white/15 bg-[#202023] p-4 shadow-xl sm:-right-3 sm:-left-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-400">
              <CheckIcon aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{t("confirmationTitle")}</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                {t("confirmationDescription")}
              </p>
            </div>
          </div>
          <figcaption className="relative mt-7 text-center text-xs text-zinc-400">
            {t("preview")}
          </figcaption>
        </figure>
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/10 bg-white/[0.025] px-7 py-4 text-xs text-zinc-400 sm:px-10 lg:px-14">
        <span>{t("account")}</span>
        <span>{t("banks")}</span>
      </div>
    </article>
  );
}
