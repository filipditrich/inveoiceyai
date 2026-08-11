"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { recordAccountSecurityEventAction } from "@/actions/security";
import { authClient } from "@/lib/auth/client";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
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
  LoaderCircleIcon,
  MailPlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersRoundIcon,
  XIcon,
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
  expiresAt?: string | Date;
};

function roleKey(role: string): "owner" | "admin" | "member" | null {
  if (role === "owner" || role === "admin" || role === "member") return role;
  return null;
}

export function MembersPanel({
  workspaceId,
  canManage,
  appOrigin,
}: {
  workspaceId: string;
  canManage: boolean;
  appOrigin: string;
}) {
  const t = useTranslations("Settings.members");
  const locale = useLocale() as AppLocale;
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const roleLabel = (value: string) => {
    const key = roleKey(value);
    return key ? t(`roles.${key}`) : value;
  };

  const formatExpiry = (value?: string | Date) => {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
      label: formatDateTime(date.toISOString(), locale),
      expired: date.getTime() < Date.now(),
    };
  };

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
      if (m.error) toast.error(m.error.message || t("loadFailed"));
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
          toast.error(res.error.message || t("invite.failed"));
          return;
        }
        await recordAccountSecurityEventAction({
          type: "invite_create",
          metadata: { email: email.trim(), role },
        });
        toast.success(t("invite.success"));
        setEmail("");
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  const resendInvite = (row: InviteRow) => {
    setBusyKey(`resend:${row.id}`);
    startTransition(async () => {
      try {
        const res = await authClient.organization.inviteMember({
          email: row.email,
          role: (row.role || "member") as "member" | "admin" | "owner",
          organizationId: workspaceId,
          resend: true,
        });
        if (res.error) {
          toast.error(res.error.message || t("invite.resendFailed"));
          return;
        }
        await recordAccountSecurityEventAction({
          type: "invite_resend",
          metadata: { email: row.email, invitationId: row.id },
        });
        toast.success(t("invite.resendSuccess"));
        reload();
      } finally {
        setBusyKey(null);
      }
    });
  };

  const cancelInvite = (invitationId: string) => {
    setBusyKey(`cancel:${invitationId}`);
    startTransition(async () => {
      try {
        const res = await authClient.organization.cancelInvitation({
          invitationId,
        });
        if (res.error) {
          toast.error(res.error.message || t("invite.cancelFailed"));
          return;
        }
        await recordAccountSecurityEventAction({
          type: "invite_cancel",
          metadata: { invitationId },
        });
        toast.success(t("invite.cancelSuccess"));
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
          toast.error(res.error.message || t("removeFailed"));
          return;
        }
        await recordAccountSecurityEventAction({
          type: "member_remove",
          metadata: { memberIdOrEmail },
        });
        toast.success(t("removeSuccess"));
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
        toast.error(res.error.message || t("roleUpdateFailed"));
        return;
      }
      await recordAccountSecurityEventAction({
        type: "member_role_update",
        metadata: { memberId, role: nextRole },
      });
      toast.success(t("roleUpdateSuccess"));
      reload();
    });
  };

  const copyInvite = async (id: string) => {
    const url = `${appOrigin.replace(/\/$/, "")}/invite/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success(t("invite.linkCopied"));
  };

  const pendingInvites = invites.filter((i) => i.status === "pending");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <UsersRoundIcon className="text-muted-foreground size-4" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {pending && members.length === 0 ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 px-5 py-8 text-sm">
              <LoaderCircleIcon className="size-4 animate-spin" />
              {t("loading")}
            </div>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground px-5 py-8 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            members.map((m) => {
              const displayName = m.user?.name || m.user?.email || m.userId;
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase">
                      {displayName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">
                          {displayName}
                        </span>
                        <Badge variant="secondary">{roleLabel(m.role)}</Badge>
                      </div>
                      <div className="text-muted-foreground truncate">
                        {m.user?.email || t("emailUnavailable")}
                      </div>
                    </div>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={t("roleAria", { name: displayName })}
                        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
                        value={m.role}
                        disabled={pending}
                        onChange={(e) => updateRole(m.id, e.target.value)}
                      >
                        <option value="member">{t("roles.member")}</option>
                        <option value="admin">{t("roles.admin")}</option>
                        <option value="owner">{t("roles.owner")}</option>
                      </select>
                      <Button
                        aria-label={t("removeAria", { name: displayName })}
                        className="text-destructive hover:text-destructive"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        loading={busyKey === `remove:${m.id}`}
                        onClick={() => removeMember(m.id)}
                      >
                        <Trash2Icon />
                        <span className="hidden sm:inline">
                          {busyKey === `remove:${m.id}`
                            ? t("removing")
                            : t("remove")}
                        </span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <MailPlusIcon className="text-muted-foreground size-4" />
              {t("invite.title")}
            </CardTitle>
            <CardDescription>{t("invite.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
              <label className="space-y-1.5 text-sm font-medium">
                {t("invite.email")}
                <Input
                  type="email"
                  placeholder={t("invite.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                {t("invite.role")}
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="member">{t("roles.member")}</option>
                  <option value="admin">{t("roles.admin")}</option>
                </select>
              </label>
              <Button
                disabled={pending || !email.trim()}
                loading={busyKey === "invite"}
                onClick={invite}
              >
                <MailPlusIcon />
                {busyKey === "invite"
                  ? t("invite.submitting")
                  : t("invite.submit")}
              </Button>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheckIcon className="text-muted-foreground size-4" />
                {t("invite.pendingTitle")}
              </div>
              {pendingInvites.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-5 text-center text-sm">
                  {t("invite.pendingEmpty")}
                </p>
              ) : (
                pendingInvites.map((i) => {
                  const expiry = formatExpiry(i.expiresAt);
                  return (
                    <div
                      key={i.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{i.email}</div>
                        <div className="text-muted-foreground text-xs">
                          {roleLabel(i.role)}
                          {expiry
                            ? ` · ${
                                expiry.expired
                                  ? t("invite.expired")
                                  : t("invite.expires", { when: expiry.label })
                              }`
                            : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void copyInvite(i.id)}
                        >
                          <CopyIcon />
                          {t("invite.copyLink")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          loading={busyKey === `resend:${i.id}`}
                          onClick={() => resendInvite(i)}
                        >
                          <RefreshCwIcon />
                          {busyKey === `resend:${i.id}`
                            ? t("invite.resending")
                            : t("invite.resend")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          loading={busyKey === `cancel:${i.id}`}
                          onClick={() => cancelInvite(i.id)}
                        >
                          <XIcon />
                          {busyKey === `cancel:${i.id}`
                            ? t("invite.canceling")
                            : t("invite.cancel")}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
