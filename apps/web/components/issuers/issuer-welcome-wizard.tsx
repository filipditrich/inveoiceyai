"use client";

import type { FormEvent } from "react";
import * as React from "react";
import {
  createIssuer,
  dismissIssuerWelcome,
  parseWelcomeInvoicePdf,
  type WelcomeClientDraft,
  type WelcomeIssuerDraft,
  type WelcomePdfParseErrorCode,
} from "@/actions/issuers";
import { updateWorkspaceAction } from "@/actions/workspace";
import {
  formatAresLookupError,
  lookupAresByIco,
  useCzechIbanSuggest,
  useInvalidQueryMessage,
} from "@/components/issuers/issuer-form-shared";
import {
  WelcomeBankStep,
  WelcomeDoneStep,
  WelcomeIdentityDetailsStep,
  WelcomeIdentityLookupStep,
  WelcomeMigrateStep,
  WelcomePathStep,
  WelcomeProgress,
  WelcomeReviewStep,
  WelcomeSkip,
  WelcomeWorkspaceStep,
} from "@/components/issuers/issuer-welcome-steps";
import {
  clearWelcomeRecovery,
  loadWelcomeRecovery,
  saveWelcomeRecovery,
} from "@/lib/issuer-welcome-recovery";
import { emitProductEvent } from "@/lib/product-analytics";
import {
  welcomeBankIsComplete,
  welcomeIdentityViewFromName,
  welcomeSetupIndex,
  welcomeStepLabelKey,
  type WelcomeIdentityView,
  type WelcomeStep,
} from "@/lib/welcome-flow";
import { useTranslations } from "next-intl";

const EMPTY_CLIENT: WelcomeClientDraft = {
  name: "",
  ico: "",
  dic: "",
  street: "",
  city: "",
  zip: "",
  country: "CZ",
  contactEmail: "",
};

function applyIssuerDraft(
  draft: WelcomeIssuerDraft,
  setters: {
    setSource: (value: "ares" | "manual") => void;
    setIcoInput: (value: string) => void;
    setName: (value: string) => void;
    setDic: (value: string) => void;
    setStreet: (value: string) => void;
    setCity: (value: string) => void;
    setZip: (value: string) => void;
    setContactEmail: (value: string) => void;
    setVatPayer: (value: boolean) => void;
    seedBank: (account: string, iban?: string) => void;
    setBic: (value: string) => void;
  },
) {
  setters.setSource("manual");
  setters.setIcoInput(draft.ico);
  setters.setName(draft.name);
  setters.setDic(draft.dic);
  setters.setStreet(draft.street);
  setters.setCity(draft.city);
  setters.setZip(draft.zip);
  setters.setContactEmail(draft.contactEmail);
  setters.setVatPayer(draft.vatPayer);
  if (draft.accountNumber) {
    setters.seedBank(draft.accountNumber, draft.iban || undefined);
  }
  if (draft.bic) {
    setters.setBic(draft.bic);
  }
}

export function IssuerWelcomeWizard(props: {
  workspaceId: string;
  workspaceName: string;
  doneIssuerId?: string | null;
  showMigrate?: boolean;
  invalidQuery?: string | null;
}) {
  const t = useTranslations("Issuers.welcome");
  const tAres = useTranslations("Issuers.ares");
  const tWorkspaceErrors = useTranslations("App.workspaceErrors");
  const invalidFromQuery = useInvalidQueryMessage(props.invalidQuery);
  const [step, setStep] = React.useState<WelcomeStep>(() => {
    if (!props.doneIssuerId) {
      return "workspace";
    }
    return props.showMigrate ? "migrate" : "done";
  });
  const [identityView, setIdentityView] =
    React.useState<WelcomeIdentityView>("path");
  const [createdId] = React.useState(() => crypto.randomUUID());
  const [doneId, setDoneId] = React.useState(props.doneIssuerId ?? "");
  const [pending, startTransition] = React.useTransition();
  const [skipPending, startSkip] = React.useTransition();
  const [lookupPending, setLookupPending] = React.useState(false);
  const [uploadPending, setUploadPending] = React.useState(false);
  const [fromReview, setFromReview] = React.useState(false);

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
  const [client, setClient] = React.useState<WelcomeClientDraft>(EMPTY_CLIENT);
  const [workspaceName, setWorkspaceName] = React.useState(props.workspaceName);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [hideQueryError, setHideQueryError] = React.useState(false);
  const analyticsEmitted = React.useRef(false);
  const visibleMessage = msg ?? (hideQueryError ? null : invalidFromQuery);
  const currentStep = welcomeSetupIndex(step);
  const stepLabel = t(`steps.${welcomeStepLabelKey(step)}`);

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
      setIdentityView(welcomeIdentityViewFromName(recovered.name));
    }, 0);
    return () => window.clearTimeout(timeout);
    // `bank` is a stable hook API, and recovery must load once only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.workspaceId]);

  React.useEffect(() => {
    if (step === "done" || step === "migrate") return;
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

  function parseErrorMessage(code: WelcomePdfParseErrorCode): string {
    return t(`parseErrors.${code}`);
  }

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
      const parsed = await parseWelcomeInvoicePdf(fd);
      if (!parsed.ok) {
        setMsg(parseErrorMessage(parsed.code));
        return;
      }
      applyIssuerDraft(parsed.draft, {
        setSource,
        setIcoInput,
        setName,
        setDic,
        setStreet,
        setCity,
        setZip,
        setContactEmail,
        setVatPayer,
        seedBank: bank.seedBank,
        setBic,
      });
      setClient(parsed.client ?? EMPTY_CLIENT);
      setFromReview(true);
      setIdentityView("review");
    } finally {
      setUploadPending(false);
    }
  }

  async function onLookupFromAres(e: FormEvent) {
    e.preventDefault();
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
      setFromReview(false);
      setIdentityView("details");
    } finally {
      setLookupPending(false);
    }
  }

  /**
   * Saves the workspace name before moving on. A workspace is created silently
   * on first sign-in, so this is the only place the owner names it.
   */
  function onWorkspaceNext(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    clearStaleQueryError();
    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      setMsg(t("workspaceNameRequired"));
      return;
    }
    const unchanged = trimmedName === props.workspaceName.trim();
    if (unchanged) {
      setIdentityView(welcomeIdentityViewFromName(name));
      setStep("identity");
      return;
    }
    startTransition(async () => {
      const result = await updateWorkspaceAction({
        name: trimmedName,
      });
      if (!result.ok) {
        setMsg(tWorkspaceErrors(result.errorCode));
        return;
      }
      setIdentityView(welcomeIdentityViewFromName(name));
      setStep("identity");
    });
  }

  function identityMissing(): boolean {
    return (
      !icoInput.trim() ||
      !name.trim() ||
      !street.trim() ||
      !city.trim() ||
      !zip.trim() ||
      !contactEmail.trim()
    );
  }

  function onIdentityNext(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    clearStaleQueryError();
    if (identityMissing()) {
      setMsg(t("identityRequired"));
      return;
    }
    setFromReview(false);
    setStep("bank");
  }

  function onReviewNext(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    clearStaleQueryError();
    if (identityMissing()) {
      setMsg(t("identityRequired"));
      return;
    }
    if (welcomeBankIsComplete(bank.accountNumber, bank.iban)) {
      submitCreate();
      return;
    }
    setStep("bank");
  }

  function buildCreateForm(): FormData {
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
    if (client.name.trim()) {
      fd.set("clientName", client.name.trim());
      fd.set("clientIco", client.ico.trim());
      fd.set("clientDic", client.dic.trim());
      fd.set("clientStreet", client.street.trim());
      fd.set("clientCity", client.city.trim());
      fd.set("clientZip", client.zip.trim());
      fd.set("clientCountry", client.country.trim() || "CZ");
      fd.set("clientContactEmail", client.contactEmail.trim());
    }
    return fd;
  }

  function submitCreate() {
    if (!welcomeBankIsComplete(bank.accountNumber, bank.iban)) {
      setMsg(t("bankRequired"));
      return;
    }
    const fd = buildCreateForm();
    startTransition(async () => {
      setDoneId(createdId);
      await createIssuer(fd);
    });
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    submitCreate();
  }

  function onSkip() {
    startSkip(async () => {
      clearWelcomeRecovery(window.sessionStorage, props.workspaceId);
      await dismissIssuerWelcome();
    });
  }

  const busy = pending || skipPending;
  const issuerReady =
    step === "done" || (Boolean(props.doneIssuerId) && step !== "migrate");

  if (issuerReady) {
    return (
      <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        <WelcomeDoneStep issuerId={props.doneIssuerId ?? doneId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WelcomeProgress
        ariaLabel={t("progressLabel")}
        current={currentStep}
        stepLabel={stepLabel}
      />
      <div className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
        {visibleMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {visibleMessage}
          </p>
        ) : null}

        {step === "workspace" ? (
          <WelcomeWorkspaceStep
            onName={setWorkspaceName}
            onSubmit={onWorkspaceNext}
            pending={pending}
            workspaceName={workspaceName}
          />
        ) : null}

        {step === "identity" && identityView === "path" ? (
          <WelcomePathStep
            onBack={() => setStep("workspace")}
            onIcoPath={() => setIdentityView("lookup")}
            onUpload={(file) => void onUploadIssuedPdf(file)}
            uploadPending={uploadPending}
          />
        ) : null}

        {step === "identity" && identityView === "lookup" ? (
          <WelcomeIdentityLookupStep
            icoInput={icoInput}
            lookupPending={lookupPending}
            onBack={() => setIdentityView("path")}
            onEnterManually={() => setIdentityView("details")}
            onIco={setIcoInput}
            onLookup={onLookupFromAres}
          />
        ) : null}

        {step === "identity" && identityView === "review" ? (
          <WelcomeReviewStep
            accountNumber={bank.accountNumber}
            clientName={client.name}
            contactEmail={contactEmail}
            iban={bank.iban}
            issuerIco={icoInput}
            issuerName={name}
            onBack={() => setIdentityView("path")}
            onContactEmail={setContactEmail}
            onEditDetails={() => setIdentityView("details")}
            onSubmit={onReviewNext}
          />
        ) : null}

        {step === "identity" && identityView === "details" ? (
          <WelcomeIdentityDetailsStep
            city={city}
            contactEmail={contactEmail}
            dic={dic}
            ico={icoInput}
            name={name}
            onBack={() => setIdentityView(fromReview ? "review" : "lookup")}
            onCity={setCity}
            onContactEmail={setContactEmail}
            onDic={setDic}
            onIco={setIcoInput}
            onName={setName}
            onStreet={setStreet}
            onSubmit={onIdentityNext}
            onVatPayer={setVatPayer}
            onZip={setZip}
            street={street}
            vatPayer={vatPayer}
            zip={zip}
          />
        ) : null}

        {step === "bank" ? (
          <WelcomeBankStep
            accountHint={bank.accountHint}
            accountNumber={bank.accountNumber}
            bic={bic}
            businessName={name}
            iban={bank.iban}
            ibanHint={bank.ibanHint}
            onAccountNumber={bank.setAccountNumber}
            onBack={() => {
              setStep("identity");
              setIdentityView(fromReview ? "review" : "details");
            }}
            onBic={setBic}
            onIban={bank.setIban}
            onSubmit={onCreate}
            pending={pending}
          />
        ) : null}

        {step === "migrate" ? (
          <WelcomeMigrateStep onSkip={() => setStep("done")} />
        ) : null}
      </div>
      {step === "migrate" || props.doneIssuerId ? null : (
        <WelcomeSkip disabled={busy} onSkip={onSkip} pending={skipPending} />
      )}
    </div>
  );
}
