import "server-only";

import { env } from "@invoicey/env/server";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function keyForVersion(version: number): Buffer {
  if (version !== 1)
    throw new Error(`bank_token_key_version_unavailable:${version}`);
  const encoded = env.BANK_TOKEN_ENCRYPTION_KEY_V1?.trim();
  if (!encoded) throw new Error("bank_token_encryption_not_configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("bank_token_encryption_key_must_be_32_bytes_base64");
  }
  return key;
}

export function isBankTokenEncryptionConfigured(): boolean {
  try {
    keyForVersion(env.BANK_TOKEN_ACTIVE_KEY_VERSION);
    return true;
  } catch {
    return false;
  }
}

export function encryptBankToken(token: string): {
  ciphertext: string;
  fingerprint: string;
  keyVersion: number;
} {
  const keyVersion = env.BANK_TOKEN_ACTIVE_KEY_VERSION;
  const key = keyForVersion(keyVersion);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token.trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: [
      `v${keyVersion}`,
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join("."),
    fingerprint: createHmac("sha256", key).update(token.trim()).digest("hex"),
    keyVersion,
  };
}

export function decryptBankToken(
  ciphertext: string,
  keyVersion: number,
): string {
  const [versionLabel, ivEncoded, tagEncoded, bodyEncoded] =
    ciphertext.split(".");
  if (
    versionLabel !== `v${keyVersion}` ||
    !ivEncoded ||
    !tagEncoded ||
    !bodyEncoded
  ) {
    throw new Error("bank_token_ciphertext_invalid");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    keyForVersion(keyVersion),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(bodyEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
