"use client";

import type { FormEvent } from "react";
import {
  BankAccountFields,
  FieldGroup,
} from "@/components/issuers/issuer-form-shared";
import { MigrationProviderGrid } from "@/components/onboarding/migration-provider-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFileDrop } from "@/components/upload/use-file-drop";
import { WorkspaceMark } from "@/components/workspace-mark";
import { cn } from "@/lib/utils";
import { WELCOME_SETUP_STEP_COUNT } from "@/lib/welcome-flow";
import { CloudUploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function WelcomeProgress({
  current,
  stepLabel,
  ariaLabel,
}: {
  current: number;
  stepLabel: string;
  ariaLabel: string;
}) {
  const t = useTranslations("Issuers.welcome");
  const percent = Math.round((current / WELCOME_SETUP_STEP_COUNT) * 100);
  return (
    <div className="space-y-2" aria-label={ariaLabel}>
      <p className="text-sm text-muted-foreground">
        {t("step", {
          current: String(current),
          total: String(WELCOME_SETUP_STEP_COUNT),
        })}
        <span aria-hidden="true"> · </span>
        <span className="font-medium text-foreground">{stepLabel}</span>
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function WelcomeSkip({
  disabled,
  pending,
  onSkip,
}: {
  disabled: boolean;
  pending: boolean;
  onSkip: () => void;
}) {
  const t = useTranslations("Issuers.welcome");
  return (
    <div className="space-y-1 pt-1 text-center">
      <Button
        disabled={disabled}
        onClick={onSkip}
        size="sm"
        type="button"
        variant="ghost"
      >
        {pending ? t("skipping") : t("skip")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("skipHint")}</p>
    </div>
  );
}

export function WelcomeWorkspaceStep({
  workspaceName,
  pending,
  onName,
  onSubmit,
}: {
  workspaceName: string;
  pending: boolean;
  onName: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const t = useTranslations("Issuers.welcome");
  const tCommon = useTranslations("Common");
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <WelcomeStepIntro hint={t("workspaceHint")} title={t("workspaceTitle")} />
      <div className="flex items-center gap-3">
        <WorkspaceMark
          className="size-12 rounded-xl text-base"
          logo={null}
          name={workspaceName.trim() || "?"}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="welcome-workspace-name">
            {t("workspaceNameLabel")}
          </Label>
          <Input
            autoFocus
            id="welcome-workspace-name"
            onChange={(ev) => onName(ev.target.value)}
            required
            value={workspaceName}
          />
        </div>
      </div>
      <Button disabled={pending} type="submit">
        {pending ? tCommon("loading") : t("continue")}
      </Button>
    </form>
  );
}

export function WelcomeIdentityLookupStep({
  icoInput,
  lookupPending,
  onIco,
  onLookup,
  onBack,
  onEnterManually,
}: {
  icoInput: string;
  lookupPending: boolean;
  onIco: (value: string) => void;
  onLookup: (e: FormEvent) => void;
  onBack: () => void;
  onEnterManually: () => void;
}) {
  const t = useTranslations("Issuers.welcome");
  const tForm = useTranslations("Issuers.form");
  const tCommon = useTranslations("Common");
  return (
    <form className="space-y-6" onSubmit={onLookup}>
      <WelcomeStepIntro hint={t("aresHint")} title={t("aresTitle")} />
      <FieldGroup label={tForm("ico")}>
        <Input
          autoFocus
          inputMode="numeric"
          maxLength={8}
          onChange={(ev) => onIco(ev.target.value)}
          pattern="\d{0,8}"
          placeholder="12345678"
          required
          value={icoInput}
        />
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBack} type="button" variant="outline">
          {tCommon("back")}
        </Button>
        <Button disabled={lookupPending} type="submit">
          {lookupPending ? tForm("lookingUp") : tForm("lookup")}
        </Button>
      </div>
      <Button onClick={onEnterManually} size="sm" type="button" variant="ghost">
        {t("enterManually")}
      </Button>
    </form>
  );
}

export function WelcomeIdentityDetailsStep({
  ico,
  name,
  dic,
  street,
  city,
  zip,
  contactEmail,
  vatPayer,
  onIco,
  onName,
  onDic,
  onStreet,
  onCity,
  onZip,
  onContactEmail,
  onVatPayer,
  onBack,
  onSubmit,
}: {
  ico: string;
  name: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  contactEmail: string;
  vatPayer: boolean;
  onIco: (value: string) => void;
  onName: (value: string) => void;
  onDic: (value: string) => void;
  onStreet: (value: string) => void;
  onCity: (value: string) => void;
  onZip: (value: string) => void;
  onContactEmail: (value: string) => void;
  onVatPayer: (value: boolean) => void;
  onBack: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const t = useTranslations("Issuers.welcome");
  const tForm = useTranslations("Issuers.form");
  const tCommon = useTranslations("Common");
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <WelcomeStepIntro
        hint={t("contactEmailHint")}
        title={t("businessDetails")}
      />
      <FieldGroup label={tForm("ico")}>
        <Input
          autoFocus={!ico.trim()}
          inputMode="numeric"
          maxLength={8}
          onChange={(ev) => onIco(ev.target.value)}
          pattern="\d{0,8}"
          required
          value={ico}
        />
      </FieldGroup>
      <FieldGroup label={tForm("name")}>
        <Input
          onChange={(ev) => onName(ev.target.value)}
          required
          value={name}
        />
      </FieldGroup>
      <FieldGroup label={tForm("dic")}>
        <Input
          onChange={(ev) => onDic(ev.target.value)}
          placeholder="CZ12345678"
          value={dic}
        />
      </FieldGroup>
      <FieldGroup label={tForm("street")}>
        <Input
          onChange={(ev) => onStreet(ev.target.value)}
          required
          value={street}
        />
      </FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldGroup label={tForm("city")}>
          <Input
            onChange={(ev) => onCity(ev.target.value)}
            required
            value={city}
          />
        </FieldGroup>
        <FieldGroup label={tForm("zip")}>
          <Input
            onChange={(ev) => onZip(ev.target.value)}
            required
            value={zip}
          />
        </FieldGroup>
      </div>
      <FieldGroup label={tForm("contactEmail")}>
        <Input
          autoFocus={Boolean(ico.trim()) && !contactEmail.trim()}
          onChange={(ev) => onContactEmail(ev.target.value)}
          required
          type="email"
          value={contactEmail}
        />
      </FieldGroup>
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={vatPayer}
          onChange={(ev) => onVatPayer(ev.target.checked)}
          type="checkbox"
        />
        {tForm("vatPayer")}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBack} type="button" variant="outline">
          {tCommon("back")}
        </Button>
        <Button type="submit">{t("continue")}</Button>
      </div>
    </form>
  );
}

export function WelcomeBankStep({
  businessName,
  accountNumber,
  iban,
  bic,
  accountHint,
  ibanHint,
  pending,
  onAccountNumber,
  onIban,
  onBic,
  onBack,
  onSubmit,
}: {
  businessName: string;
  accountNumber: string;
  iban: string;
  bic: string;
  accountHint: string | null;
  ibanHint: string | null;
  pending: boolean;
  onAccountNumber: (value: string) => void;
  onIban: (value: string) => void;
  onBic: (value: string) => void;
  onBack: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const t = useTranslations("Issuers.welcome");
  const tCommon = useTranslations("Common");
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <WelcomeStepIntro
        hint={t("bankForBusiness", { business: businessName })}
        title={t("bankTitle")}
      />
      <BankAccountFields
        accountHint={accountHint}
        accountNumber={accountNumber}
        autoFocusAccount
        bic={bic}
        iban={iban}
        ibanHint={ibanHint}
        onAccountNumber={onAccountNumber}
        onBic={onBic}
        onIban={onIban}
        required
        showBic={false}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={onBack}
          type="button"
          variant="outline"
        >
          {tCommon("back")}
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? t("saving") : t("continue")}
        </Button>
      </div>
    </form>
  );
}

export function WelcomeDoneStep({ issuerId }: { issuerId: string }) {
  const t = useTranslations("Issuers.welcome");
  return (
    <div className="space-y-6">
      <WelcomeStepIntro hint={t("doneBody")} title={t("doneTitle")} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button render={<Link href="/invoices/new" prefetch />} type="button">
          {t("createFirstInvoice")}
        </Button>
        <Button
          render={<Link href="/invoices/import" prefetch />}
          type="button"
          variant="outline"
        >
          {t("importHistory")}
        </Button>
        {issuerId ? (
          <Button
            render={
              <Link href={`/issuers/${issuerId}/edit/identity`} prefetch />
            }
            type="button"
            variant="outline"
          >
            {t("editBusiness")}
          </Button>
        ) : null}
        <Button
          render={<Link href="/dashboard" prefetch />}
          type="button"
          variant="ghost"
        >
          {t("goDashboard")}
        </Button>
      </div>
    </div>
  );
}

export function WelcomePathStep({
  uploadPending,
  onUpload,
  onIcoPath,
  onBack,
}: {
  uploadPending: boolean;
  onUpload: (file: File | null) => void;
  onIcoPath: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("Issuers.welcome");
  const tCommon = useTranslations("Common");
  const drop = useFileDrop({
    accept: "application/pdf,.pdf",
    disabled: uploadPending,
    multiple: false,
    onFiles: (files) => {
      onUpload(files[0] ?? null);
    },
  });
  return (
    <div className="space-y-6">
      <WelcomeStepIntro hint={t("pathHint")} title={t("pathTitle")} />
      <button
        {...drop.surfaceProps}
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
          drop.isDragging && "border-primary bg-primary/5",
          uploadPending && "opacity-70",
        )}
        disabled={uploadPending}
        onClick={drop.open}
        type="button"
      >
        <CloudUploadIcon className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">{t("pathUploadTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {uploadPending ? t("uploadPending") : t("pathUploadHint")}
          </p>
        </div>
        <input {...drop.inputProps} />
      </button>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBack} type="button" variant="outline">
          {tCommon("back")}
        </Button>
        <Button onClick={onIcoPath} type="button" variant="ghost">
          {t("pathIco")}
        </Button>
      </div>
    </div>
  );
}

export function WelcomeReviewStep({
  issuerName,
  issuerIco,
  accountNumber,
  iban,
  clientName,
  contactEmail,
  onContactEmail,
  onBack,
  onSubmit,
  onEditDetails,
}: {
  issuerName: string;
  issuerIco: string;
  accountNumber: string;
  iban: string;
  clientName: string;
  contactEmail: string;
  onContactEmail: (value: string) => void;
  onBack: () => void;
  onSubmit: (e: FormEvent) => void;
  onEditDetails: () => void;
}) {
  const t = useTranslations("Issuers.welcome");
  const tForm = useTranslations("Issuers.form");
  const tCommon = useTranslations("Common");
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <WelcomeStepIntro hint={t("reviewHint")} title={t("reviewTitle")} />
      <dl className="space-y-3 text-sm">
        <ReviewFact label={t("reviewIssuer")} value={issuerName} />
        <ReviewFact label={tForm("ico")} value={issuerIco} />
        <ReviewFact
          label={t("reviewBank")}
          value={iban || accountNumber || tCommon("emptyDash")}
        />
        <ReviewFact
          label={t("reviewClient")}
          value={clientName || t("reviewNoClient")}
        />
      </dl>
      <FieldGroup label={tForm("contactEmail")}>
        <Input
          autoFocus={!contactEmail.trim()}
          onChange={(ev) => onContactEmail(ev.target.value)}
          required
          type="email"
          value={contactEmail}
        />
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBack} type="button" variant="outline">
          {tCommon("back")}
        </Button>
        <Button type="submit">{t("continue")}</Button>
        <Button onClick={onEditDetails} size="sm" type="button" variant="ghost">
          {t("editExtracted")}
        </Button>
      </div>
    </form>
  );
}

export function WelcomeMigrateStep({ onSkip }: { onSkip: () => void }) {
  const t = useTranslations("Issuers.welcome");
  return (
    <div className="space-y-6">
      <WelcomeStepIntro hint={t("migrate.hint")} title={t("migrate.title")} />
      <MigrationProviderGrid />
      <Button onClick={onSkip} type="button" variant="ghost">
        {t("migrate.skip")}
      </Button>
    </div>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{value}</dd>
    </div>
  );
}

function WelcomeStepIntro({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
