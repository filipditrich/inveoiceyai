import { PageHeader } from "@/components/layout/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { WorkspaceMark } from "@/components/workspace-mark";
import { requireWorkspace } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/auth/workspaces";
import { getTranslations } from "next-intl/server";

export default async function WorkspaceSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("App.settings.scopes.workspace");
  const ws = await requireWorkspace();
  const workspaces = await listUserWorkspaces(ws.userId);
  const active = workspaces.find((item) => item.id === ws.workspaceId);

  return (
    <>
      <PageHeader
        description={t("subtitle")}
        eyebrow={t("eyebrow")}
        icon={
          active ? (
            <WorkspaceMark
              className="size-11 rounded-2xl"
              logo={active.logo}
              name={active.name}
            />
          ) : null
        }
        title={active?.name ?? t("title")}
      />
      <div className="grid min-w-0 items-start gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav scope="workspace" />
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
