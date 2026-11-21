import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// A voter has exactly one row for this gathering. Changing dates updates that row.
export const votes = pgTable(
  "gathering_votes",
  {
    voterId: text("voter_id").primaryKey(),
    date: text("vote_date").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "gathering_vote_allowed_date",
      sql`${table.date} IN ('2026-12-24', '2026-12-26', '2026-12-31', '2027-01-08')`,
    ),
  ],
);
