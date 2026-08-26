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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageUploadField } from "@/components/upload/image-upload-field";
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
  Settings2Icon,
  UsersRoundIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
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

/**
 * Also the door to workspace-scoped settings — the user menu is the door to
 * account settings. Two triggers, two scopes, no shared "Settings" page that
 * mixes them.
 */
export function WorkspaceSwitcher({
  activeWorkspaceId,
  defaultWorkspaceId,
  workspaces,
  uploadConfigured = true,
}: {
  activeWorkspaceId: string;
  defaultWorkspaceId: string | null;
  workspaces: WorkspaceListItem[];
  uploadConfigured?: boolean;
}) {
  const { isMobile } = useSidebar();
  const t = useTranslations("App.workspaceSwitcher");
  const tErrors = useTranslations("App.workspaceErrors");
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLogo, setNewLogo] = useState("");

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

  function closeCreate() {
    setCreateOpen(false);
    setNewName("");
    setNewLogo("");
  }

  function createWorkspace() {
    if (pending) return;
    startTransition(async () => {
      const result = await createWorkspaceAction({
        name: newName,
        logo: newLogo.trim() || null,
      });
      if (result && !result.ok) {
        toastActionError(tErrors, result.errorCode);
        return;
      }
      closeCreate();
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
              className="min-w-64 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("manageLabel")}</DropdownMenuLabel>
                <DropdownMenuItem
                  render={<Link href="/settings/workspace" prefetch />}
                >
                  <Settings2Icon />
                  {t("settings")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link href="/settings/workspace/members" prefetch />}
                >
                  <UsersRoundIcon />
                  {t("members")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
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

      <Sheet
        open={createOpen}
        onOpenChange={(open) => (open ? setCreateOpen(true) : closeCreate())}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("createTitle")}</SheetTitle>
            <SheetDescription>{t("createDescription")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4">
            <div className="flex items-center gap-3">
              <WorkspaceMark
                className="size-12 rounded-xl text-base"
                logo={newLogo.trim() || null}
                name={newName.trim() || "?"}
              />
              <div className="min-w-0 flex-1 space-y-2">
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
            <div className="space-y-2">
              <div className="space-y-1">
                <Label>{t("logoLabel")}</Label>
                <p className="text-muted-foreground text-xs">{t("logoHint")}</p>
              </div>
              {uploadConfigured ? (
                <ImageUploadField
                  alt={t("logoLabel")}
                  disabled={pending}
                  endpoint="workspaceLogo"
                  onUrl={(url) => setNewLogo(url ?? "")}
                  url={newLogo}
                />
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t("uploadUnavailable")}
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                {t("logoOptional")}
              </p>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" disabled={pending} onClick={closeCreate}>
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
