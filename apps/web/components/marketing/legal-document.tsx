import type { ReactNode } from "react";

export function LegalDocument({
  children,
  description,
  eyebrow,
  title,
}: Readonly<{
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}>) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <header className="border-b pb-10">
        <p className="text-primary text-sm font-semibold uppercase tracking-wide">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
          {description}
        </p>
        <p className="text-muted-foreground mt-4 text-xs">
          Poslední aktualizace: 11. srpna 2026
        </p>
      </header>
      <div className="legal-copy pt-10">{children}</div>
    </article>
  );
}
