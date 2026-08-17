"use client";

import { processIncomingUploads } from "@/actions/incoming-invoices";
import { Button } from "@/components/ui/button";
import { FileUploadZone } from "@/components/upload/file-upload-zone";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function IncomingUploadForm({
  issuers,
}: {
  issuers: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("IncomingInvoices.uploadPage");
  const tUpload = useTranslations("Upload");
  const router = useRouter();
  const [issuerId, setIssuerId] = useState(issuers[0]?.id ?? "");
  const [files, setFiles] = useState<
    Array<{ url: string; name: string; type: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="bg-card space-y-4 rounded-xl border p-5">
      <label className="grid max-w-sm gap-1 text-sm">
        <span>{t("issuer")}</span>
        <select
          value={issuerId}
          onChange={(event) => setIssuerId(event.target.value)}
          className="border-input rounded-md border px-2 py-1.5"
        >
          {issuers.map((issuer) => (
            <option key={issuer.id} value={issuer.id}>
              {issuer.name}
            </option>
          ))}
        </select>
      </label>
      <FileUploadZone
        accept="application/pdf,application/xml,text/xml,image/png,image/jpeg,.pdf,.xml,.png,.jpg,.jpeg"
        endpoint="incomingInvoiceDocument"
        files={files}
        hint={tUpload("hintIncoming")}
        maxSize={16 * 1024 * 1024}
        onRemove={(url) => {
          setFiles((prev) => prev.filter((file) => file.url !== url));
        }}
        onUploaded={(uploaded) => {
          setError(null);
          setFiles((prev) => [...prev, ...uploaded]);
        }}
      />
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        disabled={files.length === 0 || busy}
        onClick={async () => {
          setBusy(true);
          const result = await processIncomingUploads({
            files,
            issuerId: issuerId || null,
          });
          setBusy(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.invoiceIds[0]) {
            router.push(
              `/incoming-invoices/${result.invoiceIds[0]}?toast=incoming_uploaded`,
            );
            return;
          }
          router.push("/incoming-invoices/inbox?toast=incoming_uploaded");
        }}
      >
        {busy ? t("processing") : t("process")}
      </Button>
    </div>
  );
}
