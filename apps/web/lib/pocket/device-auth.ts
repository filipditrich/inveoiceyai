import { hashPocketSecret } from "@/lib/pocket/crypto";
import { NextResponse } from "next/server";

import {
  findActivePocketDeviceByTokenHash,
  touchPocketDevice,
  type PocketDeviceIdentity,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

function bearerToken(request: Request): string | null {
  const [scheme, token] =
    request.headers.get("authorization")?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}

export async function requirePocketDevice(
  request: Request,
): Promise<{ device: PocketDeviceIdentity } | { response: NextResponse }> {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    return {
      response: NextResponse.json(
        { error: "pocket_unavailable" },
        { status: 503 },
      ),
    };
  }
  const token = bearerToken(request);
  if (!token) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const device = await findActivePocketDeviceByTokenHash(
    db,
    hashPocketSecret(secret, token),
  );
  if (!device) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  await touchPocketDevice(db, device.id);
  return { device };
}
