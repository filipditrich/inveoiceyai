import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

/** Per-user Drive layout and Finder workspace visibility (ADR 0043). */
export const driveUserSettings = pgTable("drive_user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  layoutTemplate: text("layout_template")
    .notNull()
    .default("{year}/{kind}_{number}"),
  includeIsdoc: boolean("include_isdoc").notNull().default(false),
  hiddenWorkspaceIds: jsonb("hidden_workspace_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** One paired Mac install. Token hash is HMAC; plaintext never stored. */
export const driveDevices = pgTable(
  "drive_devices",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenFingerprint: text("token_fingerprint").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("drive_devices_token_hash_uidx").on(t.tokenHash),
    index("drive_devices_user_idx").on(t.userId),
  ],
);

/** One-time PKCE grant after Connect this Mac. */
export const drivePairGrants = pgTable(
  "drive_pair_grants",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
  (t) => [
    uniqueIndex("drive_pair_grants_code_hash_uidx").on(t.codeHash),
    index("drive_pair_grants_user_idx").on(t.userId),
  ],
);
