export class CompanionError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CompanionError";
  }
}

export type CompanionJson = Record<string, unknown> & { ok?: boolean };

export const CLI_USER_AGENT = "invoicey-cli/0.1.0";

function snippet(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 180);
}

/** Turn a companion HTTP body into JSON or a readable CompanionError. */
export function parseCompanionBody(
  status: number,
  contentType: string | null,
  location: string | null,
  body: string,
): CompanionJson {
  if (status === 401) {
    throw new CompanionError("unauthorized — run `invoicey login`", 401);
  }
  if (status >= 300 && status < 400) {
    throw new CompanionError(
      `redirected to ${location ?? "(no location)"} — check the API URL`,
      status,
    );
  }
  const trimmed = body.trim();
  if (!trimmed) {
    throw new CompanionError(`empty response (${status})`, status);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const kind = contentType ?? "unknown type";
    throw new CompanionError(
      `expected JSON from /api/companion, got ${kind} (${status}): ${snippet(trimmed)}`,
      status,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CompanionError(`unexpected JSON (${status})`, status);
  }
  /** SAFETY: envelope is a JSON object; callers read `ok` / `error`. */
  return parsed as CompanionJson;
}

export class CompanionClient {
  constructor(
    readonly apiUrl: string,
    readonly token: string,
  ) {}

  async op(body: Record<string, unknown>): Promise<CompanionJson> {
    const res = await fetch(`${this.apiUrl}/api/companion`, {
      method: "POST",
      redirect: "manual",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "user-agent": CLI_USER_AGENT,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return parseCompanionBody(
      res.status,
      res.headers.get("content-type"),
      res.headers.get("location"),
      text,
    );
  }

  requireOk(json: CompanionJson): CompanionJson {
    if (json.ok === false) {
      throw new CompanionError(String(json.error ?? "request failed"));
    }
    return json;
  }

  async download(
    ref: string,
    kind: "pdf" | "isdoc",
  ): Promise<{ bytes: Uint8Array; filename: string }> {
    const res = await fetch(
      `${this.apiUrl}/api/companion/invoices/${encodeURIComponent(ref)}/${kind}`,
      {
        redirect: "manual",
        headers: {
          accept: "application/pdf, application/xml, application/json",
          authorization: `Bearer ${this.token}`,
          "user-agent": CLI_USER_AGENT,
        },
      },
    );
    if (!res.ok) {
      throw await downloadError(res);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const filename =
      filenameFromDisposition(res.headers.get("content-disposition")) ??
      `invoice.${kind}`;
    return { bytes, filename };
  }
}

async function downloadError(res: Response): Promise<CompanionError> {
  const text = await res.text();
  try {
    const json = parseCompanionBody(
      res.status,
      res.headers.get("content-type"),
      res.headers.get("location"),
      text,
    );
    return new CompanionError(
      String(json.error ?? `download failed (${res.status})`),
      res.status,
    );
  } catch (err) {
    if (err instanceof CompanionError) return err;
    return new CompanionError(`download failed (${res.status})`, res.status);
  }
}

export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1]);
  const ascii = header.match(/filename="([^"]+)"/i);
  return ascii?.[1] ?? null;
}
