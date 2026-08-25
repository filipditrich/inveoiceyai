import { saveApprovalRuleAction } from "@/actions/incoming-approvals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTranslations } from "next-intl/server";

const SELECT_CLASS =
  "border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm";

/**
 * A rule answers "which path", not "who approves" — the path answers that.
 * Richer conditions (OR groups, the full fact list) arrive with the automation
 * builder in 25d; this form covers the two facts a workspace reaches for first.
 */
export async function ApprovalRuleForm({
  paths,
}: {
  paths: Array<{ id: string; name: string }>;
}) {
  const t = await getTranslations("Settings.incomingInvoices");

  return (
    <form
      action={saveApprovalRuleAction}
      className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
    >
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="approval-rule-name">{t("ruleName")}</Label>
        <Input id="approval-rule-name" name="name" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-priority">{t("priority")}</Label>
        <Input
          defaultValue={100}
          id="approval-rule-priority"
          min={1}
          name="priority"
          type="number"
        />
        <p className="text-muted-foreground text-xs">{t("priorityHint")}</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-path">{t("rulePath")}</Label>
        <select
          className={SELECT_CLASS}
          id="approval-rule-path"
          name="pathId"
          required
        >
          {paths.map((path) => (
            <option key={path.id} value={path.id}>
              {path.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-when">{t("whenCurrency")}</Label>
        <select
          className={SELECT_CLASS}
          defaultValue="CZK"
          id="approval-rule-when"
          name="whenCurrency"
        >
          <option value="CZK">CZK</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-min">{t("minTotal")}</Label>
        <Input
          id="approval-rule-min"
          inputMode="decimal"
          name="minTotal"
          placeholder={t("minTotalPlaceholder")}
        />
        <p className="text-muted-foreground text-xs">{t("minTotalHint")}</p>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">{t("saveRule")}</Button>
      </div>
    </form>
  );
}
