import { NextResponse } from "next/server";

import {
  findActiveDriveDeviceByTokenHash,
  touchDriveDevice,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

import { hashDriveSecret } from "./crypto";

export interface DriveDevicePrincipal {
  id: string;
  userId: string;
  name: string;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim() || null;
}

export async function requireDriveDevice(
  request: Request,
  options: { touch?: boolean } = {},
): Promise<{ device: DriveDevicePrincipal } | { response: NextResponse }> {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    return {
      response: NextResponse.json(
        { error: "drive_unavailable" },
        { status: 503 },
      ),
    };
  }
  const raw = bearerToken(request);
  if (!raw) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const tokenHash = hashDriveSecret(secret, raw);
  const device = await findActiveDriveDeviceByTokenHash(db, tokenHash);
  if (!device) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  if (options.touch !== false) {
    await touchDriveDevice(db, device.id);
  }
  return { device };
}
