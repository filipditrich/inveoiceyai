export type WelcomeStep =
  | "workspace"
  | "identity"
  | "bank"
  | "migrate"
  | "done";
export type WelcomeIdentityView = "path" | "lookup" | "details" | "review";

export const WELCOME_SETUP_STEP_COUNT = 4;

/** Focused onboarding chrome — no app sidebar, header, or assistant. */
export function isWelcomePath(pathname: string): boolean {
  return pathname === "/welcome" || pathname.startsWith("/welcome/");
}

/** 1-based index of the four setup steps. Done stays on the last tick. */
export function welcomeSetupIndex(step: WelcomeStep): number {
  if (step === "identity") {
    return 2;
  }
  if (step === "bank") {
    return 3;
  }
  if (step === "migrate" || step === "done") {
    return 4;
  }
  return 1;
}

export function welcomeStepLabelKey(
  step: WelcomeStep,
): "workspace" | "business" | "bank" | "history" {
  if (step === "identity") {
    return "business";
  }
  if (step === "bank") {
    return "bank";
  }
  if (step === "migrate" || step === "done") {
    return "history";
  }
  return "workspace";
}

/** Recovered business name means the details form is already worth showing. */
export function welcomeIdentityViewFromName(name: string): WelcomeIdentityView {
  return name.trim() ? "details" : "path";
}

export function welcomeBankIsComplete(
  accountNumber: string,
  iban: string,
): boolean {
  return Boolean(accountNumber.trim() && iban.trim());
}
