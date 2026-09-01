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

export class CompanionClient {
  constructor(
    readonly apiUrl: string,
    readonly token: string,
  ) {}

  async op(body: Record<string, unknown>): Promise<CompanionJson> {
    const res = await fetch(`${this.apiUrl}/api/companion`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "user-agent": "invoicey-cli/0.1.0",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      throw new CompanionError("unauthorized — run `invoicey login`", 401);
    }
    const json: unknown = await res.json().catch(() => null);
    if (!json || typeof json !== "object") {
      throw new CompanionError(`unexpected response (${res.status})`);
    }
    /** SAFETY: companion JSON is an object envelope; callers read `ok` / `error`. */
    return json as CompanionJson;
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
        headers: {
          authorization: `Bearer ${this.token}`,
          "user-agent": "invoicey-cli/0.1.0",
        },
      },
    );
    if (res.status === 401) {
      throw new CompanionError("unauthorized — run `invoicey login`", 401);
    }
    if (!res.ok) {
      const json: unknown = await res.json().catch(() => null);
      const error =
        json && typeof json === "object" && "error" in json
          ? String((json as { error: unknown }).error)
          : `download failed (${res.status})`;
      throw new CompanionError(error, res.status);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const filename =
      filenameFromDisposition(res.headers.get("content-disposition")) ??
      `invoice.${kind}`;
    return { bytes, filename };
  }
}

export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1]);
  const ascii = header.match(/filename="([^"]+)"/i);
  return ascii?.[1] ?? null;
}
