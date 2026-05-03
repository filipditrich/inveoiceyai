# ARES REST — IČO lookup (Plan 4)

## Goal

Call the public ARES **ekonomické subjekty** REST endpoint by IČO, parse the JSON defensively with **Zod**, map the primary seat (`sidlo`) into Invoicey’s **`ClientSnapshotSchema` address + identity fields**, and cache successful responses for **24 hours** per IČO inside Next.js (`unstable_cache`). The web app uses this to prefilled **new client** flows, with a **manual fallback** when ARES returns 404 or omits fields.

## References

- Swagger: [ares.gov.cz/swagger-ui](https://ares.gov.cz/swagger-ui/)
- Base path: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest`
- Documented lookup: `GET …/ekonomicke-subjekty/{ico}` where `{ico}` is **8 digits**

## Inputs / outputs

| Input | Constraints |
| --- | --- |
| IČO string | Must match `IcoSchema` (`^\d{8}$`) before any HTTP request |

| Output | Meaning |
| --- | --- |
| `ok: true`, `draft` | Parsed subject; **still missing `id`** (generated on save in `apps/web`). |
| `ok: false`, `kind: "not_found"` | HTTP 404 or ARES payload `kod: NENALEZENO`. |
| `ok: false`, `kind: "invalid_response"` | Unexpected body / Zod failure after HTTP 200. |
| `ok: false`, `kind: "http_error"` | Other non-OK status. |

`draft` fields align with data needed to build a **`ClientSnapshotSchema`** instance:

- `name` ← `obchodniJmeno`
- `ico` ← normalized 8-digit `ico` from URL/response
- `dic` ← `dic` only if it matches `ClientVatIdSchema` (e.g. `CZ27074358`)
- `address` ← mapped from `sidlo` (below)
- `contactEmail` ← optional; ARES does not provide email — **omit** (user fills manually).

## Response handling

### HTTP 200

Body is a composite **ekonomický subjekt** JSON (see live example for `27074358`). Parse with Zod using **`.passthrough()`** so extra keys from ARES do not break the parser when the schema evolves.

Required for a successful **mapped** draft:

- `obchodniJmeno` (non-empty string)
- `sidlo` object with enough data to derive `ClientAddressSchema`:
  - Prefer structured fields: `nazevUlice`, `cisloDomovni`, optional `cisloOrientacni`, `cisloOrientacniPismeno`, `psc`, `nazevObce`, `kodStatu`
  - **Fallback:** `textovaAdresa` (e.g. `Budějovická 778/3a, Michle, 14000 Praha 4`) — split on `,` for street / district+zip+city heuristics only if structured fields are incomplete

### PSC → `zip`

`sidlo.psc` is numeric (e.g. `14000`). Format as Czech **“NNN NN”**: `140 00`.

### Street line

If `nazevUlice` + `cisloDomovni` exist:

- `{nazevUlice} {cisloDomovni}` and, if `cisloOrientacni` is present, append `/{cisloOrientacni}{cisloOrientacniPismeno ?? ""}`.

Otherwise use the first segment of `textovaAdresa` (trimmed).

### Country

Map `kodStatu` two-letter code; default **`CZ`** when missing in a 200 response (ARES CZ subjects).

### HTTP 404

Body example:

```json
{
  "kod": "NENALEZENO",
  "popis": "...",
  "subKod": "VYSTUP_SUBJEKT_NENALEZEN"
}
```

Treat as **not found** so the UI can enable full manual entry without treating it as a transport error.

## Caching (Next.js)

- Wrap the **network + parse + map** pipeline in `unstable_cache`, key `['ares','ekonomicky-subjekt', ico]`, `revalidate: 86400` (24h).
- Applies to **successful** parsed results; failed lookups may be cached briefly or not cached — implementation may skip caching errors to avoid poisoning after transient failures (acceptable to refetch 404s occasionally).

## `@invoicey/ares` package

- **`client.ts`**: `fetchAresEkonomickySubjekt(ico: string): Promise<LookupAresResult>` — fetch, status handling, Zod, map to `draft`.
- **`index.ts`**: re-export types + function.
- No `unstable_cache` inside the package ( stays **framework-agnostic** ).

## Web app

- **`GET /api/ares/[ico]`** (optional): thin JSON proxy using the same cached helper for debugging and future clients.
- **Server actions**: `lookupClienteFromAres`, `createClient`, `updateClient`, `deleteClient` using `@invoicey/db` + `ClientSnapshotSchema` validation.
- **Persistence**: `clients` row stores `workspaceId` + `{ source: 'ares' | 'manual', snapshot: ClientSnapshot }` (see Drizzle schema).

## Open questions / TODOs

- `TODO(plan-5):` Issuer creation will **reuse** `fetchAresEkonomickySubjekt` plus stricter address rules (`AddressSchema` vs `ClientAddressSchema`).
- `TODO(plan-14):` Replace single default workspace id with Clerk org / tenant.
