"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminSetPlatformRole } from "@/lib/admin/set-platform-role";
import { assertPlatformAdmin } from "@/lib/auth/session";
import type { PlatformRole } from "@invoicey/db";

export async function setPlatformRoleAction(formData: FormData): Promise<void> {
  const actor = await assertPlatformAdmin();
  const targetUserId = String(formData.get("userId") ?? "").trim();
  const roleRaw = String(formData.get("role") ?? "").trim();
  const role: PlatformRole = roleRaw === "admin" ? "admin" : "none";

  if (!targetUserId) {
    redirect("/admin/users?toast=platform_admin_failed");
  }

  const result = await adminSetPlatformRole({
    actorUserId: actor.userId,
    targetUserId,
    role,
  });

  if (!result.ok) {
    redirect(
      `/admin/users?toast=${
        result.error.includes("last platform admin")
          ? "platform_admin_last"
          : "platform_admin_failed"
      }`,
    );
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect(
    `/admin/users?toast=${
      role === "admin" ? "platform_admin_granted" : "platform_admin_revoked"
    }`,
  );
}
