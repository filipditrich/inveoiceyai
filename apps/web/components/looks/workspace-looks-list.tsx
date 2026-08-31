"use client";

import {
  latestLooksById,
  type LookDocument,
} from "@invoicey/invoice-core/looks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createWorkspaceLookAction,
  deleteWorkspaceLookAction,
} from "@/actions/workspace-looks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceLooksList({
  looks,
  canEdit,
  entitled,
}: {
  looks: readonly LookDocument[];
  canEdit: boolean;
  entitled: boolean;
}) {
  const t = useTranslations("App.settings.workspace.looks");
  const tErrors = useTranslations("App.workspaceErrors");
  const router = useRouter();
  const latest = latestLooksById(
    looks.filter((look) => look.origin === "workspace"),
  );
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sourceId, setSourceId] = useState<"classic" | "minimal">("classic");

  const create = () => {
    startTransition(async () => {
      const result = await createWorkspaceLookAction({
        sourceId,
        id: slug,
        name,
      });
      if (result && "ok" in result && !result.ok) {
        toast.error(tErrors(result.errorCode));
      }
    });
  };

  const remove = (lookId: string) => {
    startTransition(async () => {
      const result = await deleteWorkspaceLookAction({ lookId });
      if (!result.ok) {
        toast.error(tErrors(result.errorCode));
        return;
      }
      toast.success(t("deleted"));
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {entitled && canEdit ? (
        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <p className="text-sm font-medium">{t("createTitle")}</p>
            <p className="text-muted-foreground text-xs">{t("createHint")}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-look-name">{t("name")}</Label>
            <Input
              id="new-look-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-look-slug">{t("slug")}</Label>
            <Input
              id="new-look-slug"
              onChange={(event) => setSlug(event.target.value)}
              value={slug}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-look-source">{t("source")}</Label>
            <select
              className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              id="new-look-source"
              onChange={(event) =>
                setSourceId(event.target.value as "classic" | "minimal")
              }
              value={sourceId}
            >
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              disabled={pending || !name.trim() || !slug.trim()}
              onClick={create}
            >
              {pending ? t("creating") : t("create")}
            </Button>
          </div>
        </div>
      ) : !entitled ? (
        <p className="text-muted-foreground text-sm">{t("lockedHint")}</p>
      ) : null}
      <ul className="space-y-2">
        {latest.map((look) => (
          <li
            key={look.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div>
              <p className="text-sm font-medium">{look.name}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                {look.id}@{look.version}
              </p>
            </div>
            <div className="flex gap-2">
              {canEdit && entitled ? (
                <>
                  <Button
                    render={
                      <Link href={`/settings/workspace/looks/${look.id}`} />
                    }
                    size="sm"
                    variant="outline"
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() => remove(look.id)}
                    size="sm"
                    variant="ghost"
                  >
                    {t("remove")}
                  </Button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
