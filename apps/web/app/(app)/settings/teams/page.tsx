import {
  addTeamMemberAction,
  createTeamAction,
  deleteTeamAction,
  removeTeamMemberAction,
} from "@/actions/workflow-paths";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireWorkspace } from "@/lib/auth/session";
import { invalidMessage } from "@/lib/invalid-message";
import { member, teamMembers, teams, user } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, asc, eq } from "drizzle-orm";
import { UsersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

const SELECT_CLASS =
  "border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm";

export default async function TeamsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const t = await getTranslations("Settings.teams");
  const tErrors = await getTranslations("Errors.invalid");
  const { workspaceId, role } = await requireWorkspace();
  const sp = await searchParams;
  const canAdmin = role === "admin" || role === "owner";
  const err = sp.invalid ? invalidMessage(tErrors, sp.invalid) : null;

  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.workspaceId, workspaceId))
    .orderBy(asc(teams.name));
  const memberships = await db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      name: user.name,
      email: user.email,
    })
    .from(teamMembers)
    .innerJoin(user, eq(user.id, teamMembers.userId))
    .where(eq(teamMembers.workspaceId, workspaceId));
  const workspaceMembers = await db
    .select({ userId: member.userId, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, workspaceId))
    .orderBy(asc(user.name));

  return (
    <div className="space-y-8">
      <SettingsPageHeader
        description={t("subtitle")}
        icon={<UsersIcon />}
        title={t("title")}
      />
      {err ? (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      ) : null}

      <p className="text-muted-foreground text-sm">{t("why")}</p>

      <section className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : null}
        {rows.map((team) => {
          const people = memberships.filter((row) => row.teamId === team.id);
          const candidates = workspaceMembers.filter(
            (row) => !people.some((person) => person.userId === row.userId),
          );
          return (
            <div
              className="bg-card space-y-3 rounded-xl border p-4"
              key={team.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>{team.name}</strong>
                  {team.description ? (
                    <p className="text-muted-foreground text-sm">
                      {team.description}
                    </p>
                  ) : null}
                </div>
                <Badge variant="outline">
                  {t("memberCount", { count: String(people.length) })}
                </Badge>
              </div>

              <ul className="flex flex-wrap gap-2">
                {people.map((person) => (
                  <li
                    className="bg-muted/50 flex items-center gap-2 rounded-lg px-2 py-1 text-sm"
                    key={person.id}
                  >
                    <span>{person.name ?? person.email}</span>
                    {canAdmin ? (
                      <form action={removeTeamMemberAction}>
                        <input name="id" type="hidden" value={person.id} />
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          type="submit"
                        >
                          ×<span className="sr-only">{t("removeMember")}</span>
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
                {people.length === 0 ? (
                  <li className="text-muted-foreground text-sm">
                    {t("noMembers")}
                  </li>
                ) : null}
              </ul>

              {canAdmin ? (
                <div className="flex flex-wrap items-end gap-2">
                  {candidates.length > 0 ? (
                    <form
                      action={addTeamMemberAction}
                      className="flex items-end gap-2"
                    >
                      <input name="teamId" type="hidden" value={team.id} />
                      <label className="grid gap-1 text-sm">
                        <span className="sr-only">{t("addMember")}</span>
                        <select className={SELECT_CLASS} name="userId">
                          {candidates.map((candidate) => (
                            <option
                              key={candidate.userId}
                              value={candidate.userId}
                            >
                              {candidate.name ?? candidate.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button size="sm" type="submit" variant="outline">
                        {t("addMember")}
                      </Button>
                    </form>
                  ) : null}
                  <form action={deleteTeamAction}>
                    <input name="id" type="hidden" value={team.id} />
                    <Button size="sm" type="submit" variant="ghost">
                      {t("deleteTeam")}
                    </Button>
                  </form>
                </div>
              ) : null}
            </div>
          );
        })}

        {canAdmin ? (
          <form
            action={createTeamAction}
            className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="team-name">{t("name")}</Label>
              <Input id="team-name" name="name" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="team-description">{t("description")}</Label>
              <Input id="team-description" name="description" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">{t("createTeam")}</Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
