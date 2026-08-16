import { saveApprovalRuleAction } from "@/actions/incoming-approvals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTranslations } from "next-intl/server";

export async function ApprovalRuleForm() {
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
          id="approval-rule-priority"
          name="priority"
          type="number"
          min={1}
          defaultValue={100}
        />
        <p className="text-muted-foreground text-xs">{t("priorityHint")}</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-when">{t("whenCurrency")}</Label>
        <select
          id="approval-rule-when"
          name="whenCurrency"
          defaultValue="CZK"
          className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
        >
          <option value="CZK">CZK</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-path">{t("pathType")}</Label>
        <select
          id="approval-rule-path"
          name="pathType"
          defaultValue="auto_approve"
          className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
        >
          <option value="auto_approve">{t("pathAutoApprove")}</option>
          <option value="require_admin">{t("pathRequireAdmin")}</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-max">{t("maxTotal")}</Label>
        <Input
          id="approval-rule-max"
          name="maxTotal"
          defaultValue="5000"
          inputMode="decimal"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="approval-rule-currency">{t("pathCurrency")}</Label>
        <select
          id="approval-rule-currency"
          name="pathCurrency"
          defaultValue="CZK"
          className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
        >
          <option value="CZK">CZK</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">{t("saveRule")}</Button>
      </div>
    </form>
  );
}
