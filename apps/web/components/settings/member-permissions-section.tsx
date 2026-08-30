import { member, user as userTable } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { asc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PermissionOverrides } from "@/lib/authz/catalog";
import { MemberPermissionsEditor } from "./member-permissions-editor";

/**
 * Per-member permission overrides for the whole workspace (ADR 0038).
 *
 * Rendered as its own server-side section rather than inside `MembersPanel`:
 * that panel is a client component that lists members through Better Auth's
 * client API, and the editor needs the `permission_overrides` column, which
 * only our own database read exposes.
 *
 * Owners are omitted — stripping `workspace:manage` from the last owner would
 * leave a workspace nobody can administer, and the action refuses it too.
 */
export async function MemberPermissionsSection({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = await getTranslations("Settings.members.permissions");

  const rows = await db
    .select({
      id: member.id,
      role: member.role,
      overrides: member.permissionOverrides,
      name: userTable.name,
      email: userTable.email,
    })
    .from(member)
    .innerJoin(userTable, eq(userTable.id, member.userId))
    .where(eq(member.organizationId, workspaceId))
    .orderBy(asc(member.createdAt));

  const editable = rows.filter((row) => row.role !== "owner");

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t("sectionTitle")}</CardTitle>
        <CardDescription>{t("sectionDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        {editable.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noMembers")}</p>
        ) : (
          editable.map((row) => (
            <div key={row.id}>
              <div className="text-sm">
                <span className="font-medium">{row.name || row.email}</span>
                <span className="text-muted-foreground ml-2">{row.email}</span>
              </div>
              <MemberPermissionsEditor
                memberId={row.id}
                overrides={
                  (row.overrides as PermissionOverrides | null) ?? null
                }
                role={row.role}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
