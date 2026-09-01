"use client";

import { useTransition } from "react";
import { updateAccountGender } from "@/actions/account";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  IssuedByGenderSchema,
  type IssuedByGender,
} from "@invoicey/invoice-core/schema";

export function AccountGenderSelect({
  value,
}: {
  readonly value: IssuedByGender;
}) {
  const t = useTranslations("App.settings.account");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Label htmlFor="account-gender">{t("genderLabel")}</Label>
      <Select
        disabled={pending}
        value={value}
        onValueChange={(next) => {
          const parsed = IssuedByGenderSchema.safeParse(next);
          if (!parsed.success || parsed.data === value) {
            return;
          }
          startTransition(async () => {
            const result = await updateAccountGender(parsed.data);
            if (!result.ok) {
              toast.error(t("genderError"));
              return;
            }
            toast.success(t("genderSaved"));
            router.refresh();
          });
        }}
      >
        <SelectTrigger className="w-full max-w-sm" id="account-gender">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectItem value="him">{t("genderHim")}</SelectItem>
          <SelectItem value="her">{t("genderHer")}</SelectItem>
          <SelectItem value="unspecified">{t("genderUnspecified")}</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("genderHint")}
      </p>
    </div>
  );
}
