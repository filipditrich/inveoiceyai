import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { workspaces } from "./workspaces";

/** A paired Invoicey Pocket installation. The bearer token is stored as HMAC only. */
export const pocketDevices = pgTable(
  "pocket_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenFingerprint: text("token_fingerprint").notNull(),
    apnsToken: text("apns_token"),
    apnsEnvironment: text("apns_environment", {
      enum: ["sandbox", "production"],
    }),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "pocket_devices_apns_environment_check",
      sql`${table.apnsEnvironment} IS NULL OR ${table.apnsEnvironment} IN ('sandbox', 'production')`,
    ),
    uniqueIndex("pocket_devices_token_hash_uidx").on(table.tokenHash),
    uniqueIndex("pocket_devices_apns_token_uidx")
      .on(table.apnsToken)
      .where(sql`${table.apnsToken} IS NOT NULL`),
    index("pocket_devices_user_idx").on(table.userId),
    index("pocket_devices_workspace_idx").on(table.workspaceId),
  ],
);

/** Five-minute, one-use PKCE grant minted after interactive web sign-in. */
export const pocketPairGrants = pgTable(
  "pocket_pair_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    deviceName: text("device_name"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("pocket_pair_grants_code_hash_uidx").on(table.codeHash),
    index("pocket_pair_grants_user_idx").on(table.userId),
  ],
);
