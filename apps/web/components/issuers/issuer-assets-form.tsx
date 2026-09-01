"use client";

import type { FormEvent } from "react";
import * as React from "react";
import { saveIssuerAssets } from "@/actions/issuers";
import {
  AssetField,
  SubmitRow,
  useInvalidQueryMessage,
} from "@/components/issuers/issuer-form-shared";
import { useTranslations } from "next-intl";

import type { IssuerSnapshot } from "@invoicey/invoice-core/schema";

export function IssuerAssetsForm(props: {
  snapshot: IssuerSnapshot;
  uploadConfigured: boolean;
  invalidQuery?: string | null;
}) {
  const t = useTranslations("Issuers.form");
  const { snapshot, uploadConfigured } = props;
  const [pending, startTransition] = React.useTransition();
  const [logoUrl, setLogoUrl] = React.useState(snapshot.logoUrl ?? "");
  const [stampUrl, setStampUrl] = React.useState(snapshot.stampUrl ?? "");
  const [signatureUrl, setSignatureUrl] = React.useState(
    snapshot.signatureUrl ?? "",
  );
  const userMsg = useInvalidQueryMessage(props.invalidQuery);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("id", snapshot.id);
    if (logoUrl.trim()) {
      fd.set("logoUrl", logoUrl.trim());
    }
    if (stampUrl.trim()) {
      fd.set("stampUrl", stampUrl.trim());
    }
    if (signatureUrl.trim()) {
      fd.set("signatureUrl", signatureUrl.trim());
    }
    startTransition(async () => {
      await saveIssuerAssets(fd);
    });
  }

  return (
    <form className="max-w-2xl space-y-6" onSubmit={onSubmit}>
      {userMsg ? <p className="text-sm text-destructive">{userMsg}</p> : null}
      {!uploadConfigured ? (
        <p className="text-xs text-muted-foreground">
          {t("uploadTokenMissing")}
        </p>
      ) : null}
      <AssetField
        label={t("logo")}
        onUrl={setLogoUrl}
        endpoint="issuerLogo"
        uploadConfigured={uploadConfigured}
        url={logoUrl}
      />
      <AssetField
        label={t("stamp")}
        onUrl={setStampUrl}
        endpoint="issuerStamp"
        uploadConfigured={uploadConfigured}
        url={stampUrl}
      />
      <AssetField
        label={t("signature")}
        onUrl={setSignatureUrl}
        endpoint="issuerSignature"
        uploadConfigured={uploadConfigured}
        url={signatureUrl}
      />
      <SubmitRow pending={pending} />
    </form>
  );
}
