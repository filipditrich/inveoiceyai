"use client";

import { processIncomingUploads } from "@/actions/incoming-invoices";
import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/lib/uploadthing";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function IncomingUploadForm({
  issuers,
}: {
  issuers: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("IncomingInvoices.uploadPage");
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
      <UploadDropzone
        endpoint="incomingInvoiceDocument"
        onClientUploadComplete={(uploaded) => {
          setFiles(
            uploaded.map((file) => ({
              url: file.ufsUrl,
              name: file.name,
              type: file.type,
            })),
          );
        }}
        onUploadError={(err) => setError(err.message)}
      />
      {files.length > 0 ? (
        <ul className="text-muted-foreground text-sm">
          {files.map((file) => (
            <li key={file.url}>{file.name}</li>
          ))}
        </ul>
      ) : null}
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
