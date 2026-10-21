import { useState } from "react";
import { CopyablePaymentFact } from "@/components/payments/copyable-payment-fact";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    invoiceyCopyQa: { locale: "cs" | "en"; messages: AbstractIntlMessages };
  }
}

function Fixture() {
  const [value, setValue] = useState("CZ6508000000192000145399");
  return (
    <NextIntlClientProvider {...window.invoiceyCopyQa} timeZone="UTC">
      <dl>
        <CopyablePaymentFact
          label="IBAN"
          value={value}
          copyLabel="Copy value"
        />
      </dl>
      <label>
        Value
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
    </NextIntlClientProvider>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<Fixture />);
