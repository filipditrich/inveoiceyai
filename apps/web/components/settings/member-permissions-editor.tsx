import { saveMemberPermissionsAction } from "@/actions/member-permissions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  PERMISSIONS,
  PRESET_PERMISSIONS,
  presetForRole,
  resolvePermissions,
  type Permission,
  type PermissionOverrides,
} from "@/lib/authz/catalog";
import { getTranslations } from "next-intl/server";

/**
 * Per-member permission overrides (ADR 0038).
 *
 * Deliberately plain: a checkbox per permission, submitting the desired
 * effective set. The action derives grant/deny from the role preset, so this
 * form never has to express "grant" and "deny" as separate concepts — which is
 * the part that would need real design work to do well.
 *
 * A first pass, not the finished surface. Missing: grouping permissions by
 * area, showing which are unavailable on the plan, and bulk editing.
 */
export async function MemberPermissionsEditor({
  memberId,
  role,
  overrides,
}: {
  memberId: string;
  role: string;
  overrides: PermissionOverrides | null;
}) {
  const t = await getTranslations("Settings.members.permissions");

  const preset = new Set(PRESET_PERMISSIONS[presetForRole(role)]);
  const effective = resolvePermissions(role, overrides);
  const changed = overrides !== null;

  return (
    <form
      action={saveMemberPermissionsAction}
      className="mt-3 space-y-4 rounded-md border border-border p-4"
    >
      <input name="memberId" type="hidden" value={memberId} />

      <div className="space-y-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-xs text-muted-foreground">
          {changed ? t("descriptionOverridden") : t("description")}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSIONS.map((permission: Permission) => (
          <div key={permission} className="flex items-center gap-2">
            <Checkbox
              defaultChecked={effective.has(permission)}
              id={`${memberId}-${permission}`}
              name="permission"
              value={permission}
            />
            <Label
              className="font-normal"
              htmlFor={`${memberId}-${permission}`}
            >
              <span className="font-mono text-xs">{permission}</span>
              {/* Marks what the role already implies, so the reader can see
                  which boxes are a deviation rather than the baseline. */}
              {preset.has(permission) ? (
                <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                  {t("fromRole")}
                </span>
              ) : null}
            </Label>
          </div>
        ))}
      </div>

      <SubmitButton size="sm" variant="outline">
        {t("save")}
      </SubmitButton>
    </form>
  );
}
