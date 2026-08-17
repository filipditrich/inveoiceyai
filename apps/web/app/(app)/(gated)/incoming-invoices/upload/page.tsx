import { IncomingUploadForm } from "@/components/incoming-invoices/incoming-upload-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";
import { UploadIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function IncomingUploadPage() {
  const [t, { workspaceId }] = await Promise.all([
    getTranslations("IncomingInvoices.uploadPage"),
    requireWorkspace(),
  ]);
  const issuers = await db
    .select({ id: issuerBusinesses.id, snapshot: issuerBusinesses.snapshot })
    .from(issuerBusinesses)
    .where(eq(issuerBusinesses.workspaceId, workspaceId));

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<UploadIcon />}
        title={t("title")}
        description={t("subtitle")}
      />
      <IncomingUploadForm
        issuers={issuers.map((issuer) => ({
          id: issuer.id,
          name:
            typeof issuer.snapshot.name === "string"
              ? issuer.snapshot.name
              : issuer.id,
        }))}
      />
    </div>
  );
}
