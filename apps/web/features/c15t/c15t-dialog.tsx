"use client";

import { useConsentManager, useHeadlessConsentUI } from "@c15t/react";
import { BarChart3Icon, LockKeyholeIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const OPTIONAL_CATEGORIES = ["measurement"] as const;

/** Invoicey-native preference sheet backed by c15t's consent store. */
export function C15tDialog() {
  const consent = useConsentManager();
  const ui = useHeadlessConsentUI();
  const [pending, setPending] = useState(false);
  const wasOpen = useRef(false);
  const open = ui.activeUI === "dialog";

  useEffect(() => {
    if (open && !wasOpen.current) {
      for (const category of OPTIONAL_CATEGORIES) {
        consent.setSelectedConsent(
          category,
          Boolean(consent.consents?.[category]),
        );
      }
    }
    wasOpen.current = open;
  }, [consent, open]);

  async function run(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) ui.closeUI();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="border-b px-5 py-5 pr-14">
          <SheetTitle className="text-lg font-semibold tracking-tight">
            Nastavení soukromí
          </SheetTitle>
          <SheetDescription className="mt-1 leading-relaxed">
            Vyberte, co může Invoicey používat. Volbu můžete kdykoliv změnit v
            patičce webu.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <ConsentCategory
            checked
            disabled
            icon={<LockKeyholeIcon />}
            title="Nezbytné"
            description="Přihlášení, zabezpečení relace a uložení vašich nastavení soukromí. Bez nich služba nemůže fungovat."
          />
          <ConsentCategory
            checked={Boolean(consent.selectedConsents?.measurement)}
            disabled={pending}
            icon={<BarChart3Icon />}
            title="Anonymní měření"
            description="Vercel Analytics nám ukáže souhrnnou návštěvnost a výkon stránek. Nepoužíváme jej pro reklamu ani profilování."
            onCheckedChange={(checked) =>
              consent.setSelectedConsent("measurement", checked)
            }
          />

          <p className="text-muted-foreground px-1 pt-2 text-xs leading-relaxed">
            Invoicey aktuálně nepoužívá reklamní cookies. Více informací najdete
            v zásadách používání cookies a ochrany soukromí.
          </p>
        </div>

        <SheetFooter className="bg-muted/25 border-t p-5">
          <Button
            className="h-10 w-full"
            disabled={pending}
            onClick={() => run(() => ui.saveCustomPreferences())}
          >
            {pending ? "Ukládám…" : "Uložit volbu"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => ui.performDialogAction("reject"))}
            >
              Pouze nezbytné
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => ui.performDialogAction("accept"))}
            >
              Povolit vše
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ConsentCategory({
  checked,
  description,
  disabled,
  icon,
  onCheckedChange,
  title,
}: Readonly<{
  checked: boolean;
  description: string;
  disabled?: boolean;
  icon: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  title: string;
}>) {
  return (
    <label className="bg-card shadow-xs has-disabled:cursor-default flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
      <span className="bg-brand/12 text-foreground grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
          {description}
        </span>
      </span>
      <Checkbox
        aria-label={title}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange?.(value === true)}
      />
    </label>
  );
}
