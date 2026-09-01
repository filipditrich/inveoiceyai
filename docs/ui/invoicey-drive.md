# Invoicey Drive UX

## Intent

Install a Mac companion, connect the Invoicey account, and find issued PDFs in Finder under Invoicey Drive. Change how files nest. Revoke a lost Mac. Understand that the website is still where invoices are created.

## Layout

### Marketing (`/`)

One companion row or footer capability: Invoicey Drive — invoices in Finder. Link to `/docs/integrations/invoicey-drive` and a download. Not a second hero stack.

### Docs

`/docs/integrations/invoicey-drive`: what it is, macOS version, install, Connect, tree example, layout tokens, revoke, FAQ (iCloud vs Invoicey Drive).

### Account Settings → Invoicey Drive (`/settings/account/drive`)

```text
Invoicey Drive
  [Download for Mac]   notarized .dmg · macOS 14+
  Install the app, then Connect Invoicey from the menu bar.

  Layout
    Template input   live preview: Filip's Workspace / Ing. Filip Ditrich / 2026 / faktura_2026001.pdf
    Presets: Year folder · Flat year prefix · Name only ({name})
    [ ] Also save .isdoc

  Workspaces in Finder
    [x] Filip's Workspace
    [ ] Old sandbox

  Devices
    MacBook Pro · last seen · Revoke
```

Pairing always starts in the Mac app (PKCE). This page does not open `/drive/connect`.

### `/drive/connect`

Signed-in confirm page. Title: Connect Invoicey Drive. Shows Apple device name if the query sent one. Primary: Connect this Mac. Secondary: Cancel (session returns error to the app).

Not signed in: existing sign-in, `next=/drive/connect?…`.

### First issued invoice (web)

If the user has zero Drive devices: calm banner on the invoice detail — “Keep a Finder copy on your Mac” → Account Settings → Invoicey Drive. Dismissible. Not a modal. In v1.

### Mac menu bar

```text
Invoicey Drive
  2 overdue
  Unpaid · 5
  Open Invoicey Drive
  Sync now
  ─────────
  Mirror folder: Proton Drive/Faktury   or  Set mirror…
  ─────────
  Account · Sign out
```

No invoice builder. Opening an invoice opens Preview / Finder, not a native editor. Mirror files get Finder color tags from `displayStatus` (green paid, orange unpaid/future, red overdue). Status stays out of the filename. Proton/iCloud often strip Finder tags; a local folder keeps them.

### Mac first launch

1. Permission note (Finder + Keychain).
2. Connect Invoicey (browser).
3. Invoicey Drive appears in the sidebar.
4. Optional: choose a mirror folder (iCloud / Proton / `_faktury`).

## Validation rules

- Layout template: non-empty; only known tokens and `/`, `_`, `-`, `.`; no `..`; max 200 chars; must include `{number}` or `{name}`. Preview uses a sample invoice.
- Hide-all-workspaces is allowed (empty Drive) but show a warning.
- Revoke is immediate; no undo other than Connect again.

## Empty / loading / error

| State            | Web                                    | Mac                                 |
| ---------------- | -------------------------------------- | ----------------------------------- |
| No devices       | Download + “connect from the menu bar” | Connect Invoicey                    |
| Connecting       | Confirm page                           | Menu: Connecting…                   |
| Empty issued set | Preview still shows sample path        | Finder domain exists, folders empty |
| Sync error       | Device row: last error                 | Menu: last error, Sync now          |
| Revoked          | Device disappears                      | Menu: Connect again; domain removed |

## Keyboard / accessibility

Settings: template field announced with live preview. Connect page: primary button is Connect this Mac. Mac menu: VoiceOver labels on Sync now and Open Invoicey Drive.

## Open questions / TODOs

- `TODO(plan-30):` Czech + English copy for Drive (catalog keys)
