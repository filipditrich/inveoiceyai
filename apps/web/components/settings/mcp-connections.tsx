import { disconnectMcp } from "@/app/(app)/settings/workspace/integrations/mcp-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listMcpConnections } from "@/lib/mcp/connections";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
export async function McpConnections({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}) {
  const t = await getTranslations("McpConnections");
  const connections = await listMcpConnections(userId, workspaceId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button render={<Link href="/docs/integrations/chatgpt" />}>
          {t("setup")}
        </Button>
        {!connections.length && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {connections.map((connection) => (
          <div
            key={connection.id}
            className="flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div>
              <p className="font-medium">
                {connection.name ?? t("application")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  connection.scopes.includes("invoicey:write")
                    ? "readWrite"
                    : "readOnly",
                )}
              </p>
            </div>
            <form action={disconnectMcp}>
              <input type="hidden" name="id" value={connection.id} />
              <Button type="submit" variant="outline">
                {t("disconnect")}
              </Button>
            </form>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
