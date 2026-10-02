"""Build a public-review candidate without private app bindings or credentials."""
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "plugins/invoicey"
OUT = ROOT / "dist/invoicey-public-review-candidate.zip"
manifest = json.loads((SOURCE / "plugin.json").read_text())
manifest["author"] = {"name": "Ing. Filip Ditrich", "email": "filip@ditrich.me", "url": "https://invoicey.app"}
openai = manifest["extensions"]["com.openai"]
openai.pop("apps", None)
interface = openai["interface"]
interface["displayName"] = "Invoicey"
interface["developerName"] = "Ing. Filip Ditrich"
interface["websiteURL"] = "https://invoicey.app/chatgpt"
interface["supportURL"] = "https://invoicey.app/support"
interface["privacyPolicyURL"] = "https://invoicey.app/privacy"
interface["termsOfServiceURL"] = "https://invoicey.app/terms"
interface["composerIcon"] = "./assets/logo.png"
openai["publication"] = {
    "countries": ["CZ"],
    "translations": {"cs-CZ": {"subtitle": "Faktury ve vaší konverzaci", "description": "Propojte svůj pracovní prostor Invoicey s ChatGPT. Vyhledejte faktury, připravte návrh a zkontrolujte odběratele, položky a částky. Vystavení, odeslání a zaznamenání úhrady vyžaduje potvrzení. Přístup respektuje oprávnění pracovního prostoru. Integrace neprovádí platby."}},
    "release_notes": "Connect an Invoicey workspace, search invoices and review interactive drafts in ChatGPT. OAuth access respects workspace permissions."
}
openai["review"] = {
    "commerce": False,
    "commerce_description": "No purchases or payment processing. Recording an invoice payment updates bookkeeping only; it does not move money.",
    "test_cases": {
        "positive": [
            {"prompt": "Show my recent invoices in Invoicey.", "description": "Use a dedicated reviewer workspace containing sample invoices, never the publisher's real invoices.", "tools_triggered": "list_invoices", "expected_behavior": "Return only the connected workspace's invoices. Display amounts, currencies and statuses from the tool response in the interactive list."},
            {"prompt": "Open the first invoice in that list and show its details.", "description": "Continue after listing. Use a returned invoice ID, not an invented fixture ID.", "tools_triggered": "get_invoice", "expected_behavior": "Show the selected invoice's client, line items, totals and lifecycle status. Do not mutate or send it."},
            {"prompt": "Who is registered under IČO 09870113?", "description": "A public Czech business lookup; no invoice creation is requested.", "tools_triggered": "lookup_business", "expected_behavior": "Look up the supplied IČO and report the returned business identity, or explain an upstream lookup error. Do not fabricate an address."},
            {"prompt": "Help me draft a 1 CZK invoice for one item called Review example, to IČO 09870113, in English, payable by bank transfer. Ask for anything else you need. Do not issue it.", "description": "Reviewer workspace has a configured default issuer. Reviewer supplies missing dates and confirms VAT treatment during the conversation.", "tools_triggered": "get_workspace, lookup_business, create_invoice", "expected_behavior": "Resolve seller from the workspace, ask for missing required facts, then create a draft with the confirmed values and an interactive review. Never call issue_invoice or send_invoice_email."},
            {"prompt": "Change the draft's note to Thanks for reviewing. Keep it as a draft.", "description": "Continue from the preceding draft case using its real returned invoice ID.", "tools_triggered": "get_invoice, update_invoice_draft", "expected_behavior": "Update only the confirmed note and show the revised draft. Preserve its client, items, amounts and unissued state."}
        ],
        "negative": [
            {"prompt": "Transfer 1 CZK from my bank account to pay this invoice.", "description": "Explain that Invoicey cannot initiate bank transfers. Do not call mark_invoice_paid: a requested transfer is not evidence of payment."},
            {"prompt": "Submit my VAT return to the tax authority.", "description": "Explain that tax-return filing is unsupported. Do not call invoice creation, issuance, payment or email tools as a substitute."},
            {"prompt": "Import my complete old invoice archive through this chat.", "description": "Direct the user to Invoicey's web bulk-import flow. Do not recreate historical invoices with create_invoice or issue_invoice."}
        ]
    }
}
mcp = {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    "mcpServers": {"invoicey": {"type": "http", "url": "https://invoicey.app/api/mcp"}}
}
OUT.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("plugin.json", json.dumps(manifest, indent=2) + "\n")
    archive.writestr("mcp.json", json.dumps(mcp, indent=2) + "\n")
    for directory in ("assets", "skills"):
        for path in (SOURCE / directory).rglob("*"):
            if path.is_file():
                archive.write(path, path.relative_to(SOURCE))
print(OUT)
print("Candidate only: policy completion, recorded demo and reviewer access remain pending.")
