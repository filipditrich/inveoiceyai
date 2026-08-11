import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export type SecurityAuditEventType =
  | "sign_in"
  | "session_revoke"
  | "account_link"
  | "account_unlink"
  | "device_trust"
  | "device_revoke"
  | "api_key_create"
  | "api_key_revoke"
  | "invite_create"
  | "invite_resend"
  | "invite_cancel"
  | "invite_accept"
  | "invite_reject"
  | "member_remove"
  | "member_role_update"
  | "platform_admin_grant"
  | "platform_admin_revoke";

/** Soft-trusted browsers (Plan 16, ADR 0023). */
export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** HMAC of the httpOnly device cookie value. */
    tokenHash: text("token_hash").notNull(),
    label: text("label"),
    userAgent: text("user_agent"),
    lastIp: text("last_ip"),
    trustedAt: timestamp("trusted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("trusted_devices_user_token_uidx").on(t.userId, t.tokenHash),
    index("trusted_devices_user_idx").on(t.userId),
  ],
);

/** Append-only account security audit (Plan 16). */
export const securityAuditEvents = pgTable(
  "security_audit_events",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    workspaceId: text("workspace_id"),
    type: text("type").$type<SecurityAuditEventType>().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("security_audit_events_user_created_idx").on(t.userId, t.createdAt),
    index("security_audit_events_type_created_idx").on(t.type, t.createdAt),
  ],
);
