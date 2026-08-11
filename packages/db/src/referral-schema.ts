import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export type ReferralEventType = "click" | "signup";

/** Append-only referral click / signup log (ADR 0025, Plan 19). */
export const referralEvents = pgTable(
  "referral_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    /** click | signup */
    type: text("type").$type<ReferralEventType>().notNull(),
    referredUserId: text("referred_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("referral_events_referrer_created_idx").on(
      t.referrerUserId,
      t.createdAt,
    ),
    index("referral_events_code_created_idx").on(t.code, t.createdAt),
    index("referral_events_type_created_idx").on(t.type, t.createdAt),
  ],
);
