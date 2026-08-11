"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { recordAccountSecurityEventAction } from "@/actions/security";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CopyIcon,
  MailPlusIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersRoundIcon,
} from "lucide-react";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user?: { name?: string; email?: string };
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Vlastník",
  admin: "Správce",
  member: "Člen",
};

export function MembersPanel({
  workspaceId,
  canManage,
  appOrigin,
}: {
  workspaceId: string;
  canManage: boolean;
  appOrigin: string;
}) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = () => {
    startTransition(async () => {
      const [m, i] = await Promise.all([
        authClient.organization.listMembers({
          query: { organizationId: workspaceId },
        }),
        authClient.organization.listInvitations({
          query: { organizationId: workspaceId },
        }),
      ]);
      if (m.error) toast.error(m.error.message || "Členové se nenačetli");
      else {
        const payload = m.data as { members?: MemberRow[] } | null;
        setMembers(payload?.members ?? []);
      }
      if (!i.error) {
        setInvites(Array.isArray(i.data) ? (i.data as InviteRow[]) : []);
      }
    });
  };

  useEffect(() => {
    reload();
    // remount when active workspace changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload closes over startTransition
  }, [workspaceId]);

  const invite = () => {
    if (!email.trim()) return;
    setBusyKey("invite");
    startTransition(async () => {
      try {
        const res = await authClient.organization.inviteMember({
          email: email.trim(),
          role: role as "member" | "admin" | "owner",
          organizationId: workspaceId,
        });
        if (res.error) {
          toast.error(res.error.message || "Pozvánka selhala");
          return;
        }
        await recordAccountSecurityEventAction({
          type: "invite_create",
          metadata: { email: email.trim(), role },
        });
        toast.success("Pozvánka vytvořena");
        setEmail("");
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  const removeMember = (memberIdOrEmail: string) => {
    setBusyKey(`remove:${memberIdOrEmail}`);
    startTransition(async () => {
      try {
        const res = await authClient.organization.removeMember({
          memberIdOrEmail,
          organizationId: workspaceId,
        });
        if (res.error) {
          toast.error(res.error.message || "Odebrání selhalo");
          return;
        }
        await recordAccountSecurityEventAction({
          type: "member_remove",
          metadata: { memberIdOrEmail },
        });
        toast.success("Člen odebrán");
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  const updateRole = (memberId: string, nextRole: string) => {
    startTransition(async () => {
      const res = await authClient.organization.updateMemberRole({
        memberId,
        role: nextRole as "member" | "admin" | "owner",
        organizationId: workspaceId,
      });
      if (res.error) {
        toast.error(res.error.message || "Změna role selhala");
        return;
      }
      await recordAccountSecurityEventAction({
        type: "member_role_update",
        metadata: { memberId, role: nextRole },
      });
      toast.success("Role aktualizována");
      reload();
    });
  };

  const copyInvite = async (id: string) => {
    const url = `${appOrigin.replace(/\/$/, "")}/invite/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Odkaz zkopírován");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <UsersRoundIcon className="text-muted-foreground size-4" />
            Členové pracovního prostoru
          </CardTitle>
          <CardDescription>
            Vlastníci a správci mohou měnit členství. Běžní členové pracují s
            fakturačními daty.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {pending && members.length === 0 ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-5 py-8 text-sm">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Načítám členy…
            </div>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground px-5 py-8 text-center text-sm">
              V tomto pracovním prostoru zatím nejsou žádní členové.
            </p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase">
                    {(m.user?.name || m.user?.email || "?").slice(0, 1)}
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">
                        {m.user?.name || m.user?.email || m.userId}
                      </span>
                      <Badge variant="secondary">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground truncate">
                      {m.user?.email || "E-mail není dostupný"}
                    </div>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Role uživatele ${m.user?.name || m.user?.email || m.userId}`}
                      className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => updateRole(m.id, e.target.value)}
                    >
                      <option value="member">Člen</option>
                      <option value="admin">Správce</option>
                      <option value="owner">Vlastník</option>
                    </select>
                    <Button
                      aria-label={`Odebrat uživatele ${m.user?.name || m.user?.email || m.userId}`}
                      className="text-destructive hover:text-destructive"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      loading={busyKey === `remove:${m.id}`}
                      onClick={() => removeMember(m.id)}
                    >
                      <Trash2Icon />
                      <span className="hidden sm:inline">
                        {busyKey === `remove:${m.id}` ? "Odebírám…" : "Odebrat"}
                      </span>
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <MailPlusIcon className="text-muted-foreground size-4" />
              Pozvat člena
            </CardTitle>
            <CardDescription>
              Pošlete pozvánku e-mailem. Odkaz můžete zkopírovat a předat i
              jinou cestou.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
              <label className="space-y-1.5 text-sm font-medium">
                E-mail
                <Input
                  type="email"
                  placeholder="kolega@firma.cz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Role
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="member">Člen</option>
                  <option value="admin">Správce</option>
                </select>
              </label>
              <Button
                disabled={pending || !email.trim()}
                loading={busyKey === "invite"}
                onClick={invite}
              >
                <MailPlusIcon />
                {busyKey === "invite" ? "Odesílám…" : "Odeslat pozvánku"}
              </Button>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheckIcon className="text-muted-foreground size-4" />
                Čekající pozvánky
              </div>
              {invites.filter((i) => i.status === "pending").length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-5 text-center text-sm">
                  Žádné nevyřízené pozvánky.
                </p>
              ) : (
                invites
                  .filter((i) => i.status === "pending")
                  .map((i) => (
                    <div
                      key={i.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                    >
                      <div>
                        <div className="font-medium">{i.email}</div>
                        <div className="text-muted-foreground text-xs">
                          Role: {ROLE_LABELS[i.role] ?? i.role}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyInvite(i.id)}
                      >
                        <CopyIcon />
                        Kopírovat odkaz
                      </Button>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
