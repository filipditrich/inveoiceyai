"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { recordAccountSecurityEventAction } from "@/actions/security";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    startTransition(async () => {
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
    });
  };

  const removeMember = (memberIdOrEmail: string) => {
    startTransition(async () => {
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
        <CardHeader>
          <CardTitle>Členové workspace</CardTitle>
          <CardDescription>Role owner / admin / member.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="text-sm">
                <div className="font-medium">
                  {m.user?.name || m.user?.email || m.userId}
                </div>
                <div className="text-muted-foreground">
                  {m.user?.email} · {m.role}
                </div>
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  <select
                    className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => updateRole(m.id, e.target.value)}
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                    <option value="owner">owner</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => removeMember(m.id)}
                  >
                    Odebrat
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Pozvat</CardTitle>
            <CardDescription>
              E-mail pozvánky + zkopírovatelný odkaz jako záloha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-xs"
              />
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
              <Button disabled={pending} onClick={invite}>
                Pozvat
              </Button>
            </div>
            <div className="space-y-2">
              {invites
                .filter((i) => i.status === "pending")
                .map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {i.email} · {i.role}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyInvite(i.id)}
                    >
                      Kopírovat odkaz
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
