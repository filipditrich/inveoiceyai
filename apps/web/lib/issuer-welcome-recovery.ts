export type WelcomeRecovery = {
  icoInput: string;
  name: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  contactEmail: string;
  vatPayer: boolean;
  accountNumber: string;
  iban: string;
  bic: string;
};

const keyPrefix = "invoicey:issuer-welcome:";
const key = (workspaceId: string) => `${keyPrefix}${workspaceId}`;

export function loadWelcomeRecovery(
  storage: Storage,
  workspaceId: string,
): WelcomeRecovery | null {
  const raw = storage.getItem(key(workspaceId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WelcomeRecovery;
  } catch {
    storage.removeItem(key(workspaceId));
    return null;
  }
}

export function saveWelcomeRecovery(
  storage: Storage,
  workspaceId: string,
  value: WelcomeRecovery,
) {
  storage.setItem(key(workspaceId), JSON.stringify(value));
}

export function clearWelcomeRecovery(storage: Storage, workspaceId: string) {
  storage.removeItem(key(workspaceId));
}
