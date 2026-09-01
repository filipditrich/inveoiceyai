"use server";

import { requireSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { user as userTable } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  IssuedByGenderSchema,
  type IssuedByGender,
} from "@invoicey/invoice-core/schema";

export async function updateAccountGender(
  gender: IssuedByGender,
): Promise<{ ok: true } | { ok: false }> {
  const parsed = IssuedByGenderSchema.safeParse(gender);
  if (!parsed.success) {
    return { ok: false };
  }
  const session = await requireSession();
  await db
    .update(userTable)
    .set({ gender: parsed.data, updatedAt: new Date() })
    .where(eq(userTable.id, session.id));
  revalidatePath("/settings/account");
  return { ok: true };
}
