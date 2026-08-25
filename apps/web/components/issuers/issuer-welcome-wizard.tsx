"use client";

import {
  createIssuer,
  dismissIssuerWelcome,
  parseIssuerFromWelcomePdf,
} from "@/actions/issuers";
import {
  BankAccountFields,
  FieldGroup,
  formatAresLookupError,
  lookupAresByIco,
  useCzechIbanSuggest,
  useInvalidQueryMessage,
} from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearWelcomeRecovery,
  loadWelcomeRecovery,
  saveWelcomeRecovery,
} from "@/lib/issuer-welcome-recovery";
import { emitProductEvent } from "@/lib/product-analytics";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import * as React from "react";

type Step = "identity" | "bank" | "done";

export function IssuerWelcomeWizard(props: {
  workspaceId: string;
  invalidQuery?: string | null;
  doneIssuerId?: string | null;
}) {
  const t = useTranslations("Issuers.welcome");
  const tForm = useTranslations("Issuers.form");
  const tAres = useTranslations("Issuers.ares");
  const tCommon = useTranslations("Common");
  const invalidFromQuery = useInvalidQueryMessage(props.invalidQuery);
  const [step, setStep] = React.useState<Step>(
    props.doneIssuerId ? "done" : "identity",
  );
  const [createdId] = React.useState(() => crypto.randomUUID());
  const [doneId, setDoneId] = React.useState(props.doneIssuerId ?? "");
  const [pending, startTransition] = React.useTransition();
  const [skipPending, startSkip] = React.useTransition();
  const [lookupPending, setLookupPending] = React.useState(false);
  const [uploadPending, setUploadPending] = React.useState(false);

  const [source, setSource] = React.useState<"ares" | "manual">("manual");
  const [icoInput, setIcoInput] = React.useState("");
  const [name, setName] = React.useState("");
  const [dic, setDic] = React.useState("");
  const [street, setStreet] = React.useState("");
  const [city, setCity] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [vatPayer, setVatPayer] = React.useState(true);
  const bank = useCzechIbanSuggest();
  const [bic, setBic] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [hideQueryError, setHideQueryError] = React.useState(false);
  const analyticsEmitted = React.useRef(false);
  const visibleMessage = msg ?? (hideQueryError ? null : invalidFromQuery);
  const currentStep = step === "identity" ? 1 : step === "bank" ? 2 : 3;
  const steps = ["business", "bank", "ready"] as const;

  function clearStaleQueryError() {
    if (!props.invalidQuery) return;
    setHideQueryError(true);
    window.history.replaceState(window.history.state, "", "/welcome");
  }

  React.useEffect(() => {
    const recovered = loadWelcomeRecovery(
      window.sessionStorage,
      props.workspaceId,
    );
    if (!recovered) return;
    const timeout = window.setTimeout(() => {
      setIcoInput(recovered.icoInput);
      setName(recovered.name);
      setDic(recovered.dic);
      setStreet(recovered.street);
      setCity(recovered.city);
      setZip(recovered.zip);
      setContactEmail(recovered.contactEmail);
      setVatPayer(recovered.vatPayer);
      bank.seedBank(recovered.accountNumber, recovered.iban || undefined);
      setBic(recovered.bic);
    }, 0);
    return () => window.clearTimeout(timeout);
    // `bank` is a stable hook API, and recovery must load once only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.workspaceId]);

  React.useEffect(() => {
    if (step === "done") return;
    const timeout = window.setTimeout(() => {
      saveWelcomeRecovery(window.sessionStorage, props.workspaceId, {
        icoInput,
        name,
        dic,
        street,
        city,
        zip,
        contactEmail,
        vatPayer,
        accountNumber: bank.accountNumber,
        iban: bank.iban,
        bic,
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [
    bank.accountNumber,
    bank.iban,
    bic,
    city,
    contactEmail,
    dic,
    icoInput,
    name,
    props.workspaceId,
    step,
    street,
    vatPayer,
    zip,
  ]);

  React.useEffect(() => {
    if (analyticsEmitted.current) return;
    analyticsEmitted.current = true;
    emitProductEvent(
      props.doneIssuerId ? "onboarding_completed" : "onboarding_started",
      { routeKind: "welcome" },
    );
  }, [props.doneIssuerId]);

  React.useEffect(() => {
    if (step === "done" || props.doneIssuerId) {
      clearWelcomeRecovery(window.sessionStorage, props.workspaceId);
    }
  }, [props.doneIssuerId, props.workspaceId, step]);

  async function onUploadIssuedPdf(file: File | null) {
    if (!file) {
      return;
    }
    clearStaleQueryError();
    setMsg(null);
    setUploadPending(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const result = await parseIssuerFromWelcomePdf(fd);
      if (!result.ok) {
        setMsg(result.message);
        return;
      }
      const { draft } = result;
      setSource("manual");
      setIcoInput(draft.ico);
      setName(draft.name);
      setDic(draft.dic);
      setStreet(draft.street);
      setCity(draft.city);
      setZip(draft.zip);
      setContactEmail(draft.contactEmail);
      setVatPayer(draft.vatPayer);
      if (draft.accountNumber) {
        bank.seedBank(draft.accountNumber, draft.iban || undefined);
      }
      if (draft.bic) {
        setBic(draft.bic);
      }
    } finally {
      setUploadPending(false);
    }
  }

  async function onLookupFromAres() {
    clearStaleQueryError();
    setMsg(null);
    setLookupPending(true);
    try {
      const result = await lookupAresByIco(icoInput);
      if (!result.ok) {
        setMsg(formatAresLookupError(result, tAres));
        return;
      }
      const { draft } = result;
      setSource("ares");
      setName(draft.name);
      setDic(draft.dic ?? "");
      setStreet(draft.address.street);
      setCity(draft.address.city);
      setZip(draft.address.zip);
      if (draft.contactEmail) {
        setContactEmail(draft.contactEmail);
      }
      if (draft.ico) {
        setIcoInput(draft.ico);
      }
    } finally {
      setLookupPending(false);
    }
  }

  function onIdentityNext(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    clearStaleQueryError();
    if (
      !icoInput.trim() ||
      !name.trim() ||
      !street.trim() ||
      !city.trim() ||
      !zip.trim() ||
      !contactEmail.trim()
    ) {
      setMsg(t("identityRequired"));
      return;
    }
    setStep("bank");
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!bank.accountNumber.trim() || !bank.iban.trim()) {
      setMsg(t("bankRequired"));
      return;
    }
    const fd = new FormData();
    fd.set("id", createdId);
    fd.set("source", source);
    fd.set("name", name);
    fd.set("ico", icoInput.trim());
    if (dic.trim()) {
      fd.set("dic", dic.trim());
    }
    fd.set("street", street);
    fd.set("city", city);
    fd.set("zip", zip);
    fd.set("contactEmail", contactEmail.trim());
    fd.set("accountNumber", bank.accountNumber.trim());
    fd.set("iban", bank.iban.trim());
    if (bic.trim()) {
      fd.set("bic", bic.trim());
    }
    fd.set("vatPayer", vatPayer ? "true" : "false");
    fd.set("next", "welcome");
    startTransition(async () => {
      setDoneId(createdId);
      await createIssuer(fd);
    });
  }

  if (step === "done" || props.doneIssuerId) {
    const issuerId = props.doneIssuerId ?? doneId;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <WelcomeProgress
          ariaLabel={t("progressLabel")}
          current={3}
          labels={steps.map((key) => t(`steps.${key}`))}
        />
        <div className="bg-card space-y-2 rounded-xl border p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("doneTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("doneBody")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/invoices/new" prefetch />} size="sm">
            {t("createFirstInvoice")}
          </Button>
          {issuerId ? (
            <Button
              render={
                <Link href={`/issuers/${issuerId}/edit/identity`} prefetch />
              }
              size="sm"
              variant="outline"
            >
              {t("editBusiness")}
            </Button>
          ) : null}
          <Button
            render={<Link href="/dashboard" prefetch />}
            size="sm"
            variant="ghost"
          >
            {t("goDashboard")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <WelcomeProgress
        ariaLabel={t("progressLabel")}
        current={currentStep}
        labels={steps.map((key) => t(`steps.${key}`))}
      />
      <div className="bg-card space-y-6 rounded-xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {step === "identity" ? t("identityHint") : t("bankHint")}
            </p>
          </div>
          <Button
            disabled={skipPending || pending}
            onClick={() => {
              startSkip(async () => {
                clearWelcomeRecovery(window.sessionStorage, props.workspaceId);
                await dismissIssuerWelcome();
              });
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {skipPending ? t("skipping") : t("skip")}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">{t("skipHint")}</p>
        {visibleMessage ? (
          <p className="text-destructive text-sm" role="alert">
            {visibleMessage}
          </p>
        ) : null}

        {step === "identity" ? (
          <form className="space-y-6" onSubmit={onIdentityNext}>
            <fieldset className="space-y-4">
              <legend className="font-medium">{t("aresTitle")}</legend>
              <p className="text-muted-foreground text-sm">{t("aresHint")}</p>
              <FieldGroup label={tForm("ico")}>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="max-w-xs"
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(ev) => {
                      setIcoInput(ev.target.value);
                    }}
                    pattern="\d{0,8}"
                    placeholder="12345678"
                    required
                    value={icoInput}
                  />
                  <Button
                    disabled={lookupPending}
                    onClick={() => void onLookupFromAres()}
                    type="button"
                    variant="secondary"
                  >
                    {lookupPending ? tForm("lookingUp") : tForm("lookup")}
                  </Button>
                </div>
              </FieldGroup>
            </fieldset>
            <fieldset className="space-y-4">
              <legend className="font-medium">{t("businessDetails")}</legend>
              <p className="text-muted-foreground text-sm">
                {t("contactEmailHint")}
              </p>
              <FieldGroup label={tForm("name")}>
                <Input
                  onChange={(ev) => {
                    setName(ev.target.value);
                  }}
                  required
                  value={name}
                />
              </FieldGroup>
              <FieldGroup label={tForm("dic")}>
                <Input
                  onChange={(ev) => {
                    setDic(ev.target.value);
                  }}
                  placeholder="CZ12345678"
                  value={dic}
                />
              </FieldGroup>
              <FieldGroup label={tForm("street")}>
                <Input
                  onChange={(ev) => {
                    setStreet(ev.target.value);
                  }}
                  required
                  value={street}
                />
              </FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label={tForm("city")}>
                  <Input
                    onChange={(ev) => setCity(ev.target.value)}
                    required
                    value={city}
                  />
                </FieldGroup>
                <FieldGroup label={tForm("zip")}>
                  <Input
                    onChange={(ev) => setZip(ev.target.value)}
                    required
                    value={zip}
                  />
                </FieldGroup>
              </div>
              <FieldGroup label={tForm("contactEmail")}>
                <Input
                  onChange={(ev) => setContactEmail(ev.target.value)}
                  required
                  type="email"
                  value={contactEmail}
                />
              </FieldGroup>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={vatPayer}
                  onChange={(ev) => setVatPayer(ev.target.checked)}
                  type="checkbox"
                />
                {tForm("vatPayer")}
              </label>
            </fieldset>
            <fieldset className="border-t pt-4">
              <legend className="text-muted-foreground px-1 text-sm">
                {t("isdocAlternative")}
              </legend>
              <FieldGroup label={t("uploadLabel")}>
                <Input
                  accept="application/pdf,.pdf"
                  disabled={uploadPending}
                  onChange={(ev) => {
                    void onUploadIssuedPdf(ev.target.files?.[0] ?? null);
                    ev.target.value = "";
                  }}
                  type="file"
                />
                <p className="text-muted-foreground text-xs">
                  {uploadPending ? t("uploadPending") : t("uploadHint")}
                </p>
              </FieldGroup>
            </fieldset>
            <div className="flex gap-2">
              <Button type="submit">{t("continue")}</Button>
            </div>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onCreate}>
            <p className="text-muted-foreground text-sm">
              {t("bankForBusiness", { business: name })}
            </p>
            <BankAccountFields
              accountHint={bank.accountHint}
              accountNumber={bank.accountNumber}
              bic={bic}
              iban={bank.iban}
              ibanHint={bank.ibanHint}
              onAccountNumber={bank.setAccountNumber}
              onBic={setBic}
              onIban={bank.setIban}
              required
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() => {
                  setStep("identity");
                }}
                type="button"
                variant="outline"
              >
                {tCommon("back")}
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? tForm("creating") : tForm("create")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function WelcomeProgress({
  current,
  labels,
  ariaLabel,
}: {
  current: number;
  labels: string[];
  ariaLabel: string;
}) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={ariaLabel}>
      {labels.map((label, index) => {
        const position = index + 1;
        return (
          <li className="flex items-center gap-2 text-sm" key={label}>
            <span
              className={
                position <= current
                  ? "bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                  : "bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
              }
            >
              {position}
            </span>
            <span
              className={
                position === current ? "font-medium" : "text-muted-foreground"
              }
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
