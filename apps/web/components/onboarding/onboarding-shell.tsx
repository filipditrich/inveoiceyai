import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastFromSearchParams } from "@/components/toast-from-search-params";

/** App chrome without sidebar, breadcrumbs, or the assistant shortcut. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <BrandLogo size={28} priority variant="wordmark" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LocaleSwitcher compact />
        </div>
      </header>
      <ToastFromSearchParams />
      <div className="flex flex-1 justify-center px-4 py-6 sm:px-8 sm:py-10">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
