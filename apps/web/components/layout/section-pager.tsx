"use client";

import {
  type SectionId,
  type SectionPage,
  sectionSiblingPages,
} from "@/lib/section-nav";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Quick-link tiles to the other landings in a sidebar group. Every landing
 * shows the full sibling set, including the group home on the last page.
 */
export function SectionPager({ group }: { group: SectionId }) {
  const pathname = usePathname();
  const siblings = sectionSiblingPages(group, pathname);
  if (!siblings || siblings.length === 0) return null;

  return (
    <nav className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {siblings.map((page) => (
        <SectionTile key={page.id} page={page} />
      ))}
    </nav>
  );
}

function SectionTile({ page }: { page: SectionPage }) {
  const t = useTranslations("App.section");
  return (
    <Link
      className="rounded-lg border bg-card p-4 text-card-foreground ring-1 ring-border transition-colors hover:bg-accent/40"
      href={page.href}
      prefetch
    >
      <p className="font-medium">{t(page.titleKey)}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {t(page.descriptionKey)}
      </p>
    </Link>
  );
}
