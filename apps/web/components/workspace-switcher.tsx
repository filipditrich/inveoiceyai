"use client";

import {
  createWorkspaceAction,
  switchWorkspaceAction,
  type WorkspaceActionErrorCode,
} from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { WorkspaceMark } from "@/components/workspace-mark";
import type { WorkspaceListItem } from "@/lib/auth/workspace-types";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const ROLE_KEYS = {
  owner: "roles.owner",
  admin: "roles.admin",
  member: "roles.member",
} as const;

function toastActionError(
  tErrors: (key: WorkspaceActionErrorCode) => string,
  errorCode: WorkspaceActionErrorCode,
) {
  toast.error(tErrors(errorCode));
}

export function WorkspaceSwitcher({
  activeWorkspaceId,
  defaultWorkspaceId,
  workspaces,
}: {
  activeWorkspaceId: string;
  defaultWorkspaceId: string | null;
  workspaces: WorkspaceListItem[];
}) {
  const { isMobile } = useSidebar();
  const t = useTranslations("App.workspaceSwitcher");
  const tErrors = useTranslations("App.workspaceErrors");
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const active =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const defaultWorkspace = workspaces.find((w) => w.id === defaultWorkspaceId);
  const defaultDiverges =
    Boolean(defaultWorkspaceId) &&
    Boolean(active) &&
    defaultWorkspaceId !== active?.id;

  function switchTo(organizationId: string) {
    if (organizationId === activeWorkspaceId || pending) return;
    startTransition(async () => {
      const result = await switchWorkspaceAction(organizationId);
      if (result && !result.ok) {
        toastActionError(tErrors, result.errorCode);
      }
    });
  }

  function createWorkspace() {
    if (pending) return;
    startTransition(async () => {
      const result = await createWorkspaceAction(newName);
      if (result && !result.ok) {
        toastActionError(tErrors, result.errorCode);
        return;
      }
      setCreateOpen(false);
      setNewName("");
    });
  }

  if (!active) {
    return null;
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="ring-sidebar-border/60 data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
                  tooltip={t("label")}
                />
              }
            >
              <WorkspaceMark logo={active.logo} name={active.name} />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{active.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {defaultDiverges
                    ? t("defaultDivergesShort", {
                        name: defaultWorkspace?.name ?? "…",
                      })
                    : t(ROLE_KEYS[active.role])}
                </span>
              </div>
              {pending ? (
                <LoaderCircleIcon className="ml-auto size-4 animate-spin" />
              ) : (
                <ChevronsUpDownIcon className="ml-auto size-4 opacity-60" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
              {defaultDiverges ? (
                <div className="text-muted-foreground px-1.5 pb-1.5 text-xs leading-snug">
                  <span className="inline-flex items-start gap-1.5">
                    <KeyRoundIcon className="mt-0.5 size-3.5 shrink-0" />
                    {t("defaultDivergesHint", {
                      name: defaultWorkspace?.name ?? "…",
                    })}
                  </span>
                </div>
              ) : null}
              {workspaces.map((workspace) => {
                const isActive = workspace.id === active.id;
                const isDefault = workspace.id === defaultWorkspaceId;
                return (
                  <DropdownMenuItem
                    key={workspace.id}
                    disabled={pending}
                    onClick={() => switchTo(workspace.id)}
                  >
                    <WorkspaceMark
                      className="size-7"
                      logo={workspace.logo}
                      name={workspace.name}
                    />
                    <div className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate font-medium">
                        {workspace.name}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {t(ROLE_KEYS[workspace.role])}
                        {isDefault ? ` · ${t("apiKeysDefaultBadge")}` : ""}
                      </span>
                    </div>
                    {isActive ? (
                      <CheckIcon className="ml-auto size-4 shrink-0" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon />
                {t("create")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("createTitle")}</SheetTitle>
            <SheetDescription>{t("createDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">{t("nameLabel")}</Label>
              <Input
                id="workspace-name"
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    createWorkspace();
                  }
                }}
                placeholder={t("namePlaceholder")}
                disabled={pending}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={pending || !newName.trim()}
              onClick={() => createWorkspace()}
            >
              {pending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : null}
              {t("createSubmit")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
