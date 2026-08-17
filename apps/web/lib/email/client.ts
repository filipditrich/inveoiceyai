import "server-only";

import { isEmailTransportConfigured } from "@invoicey/invoice-tools/email";

/** True when the active email transport has credentials. */
export function isEmailConfigured(): boolean {
  return isEmailTransportConfigured();
}
