import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  trackWitr: boolean("track_witr").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const prayerDays = pgTable(
  "prayer_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 1..N — used for ordering and for "Day N" labels
    dayIndex: integer("day_index").notNull(),
    // Set when the day came from a date range; null when it came from a quick amount
    dayDate: date("day_date"),
    fajr: boolean("fajr").notNull().default(false),
    zuhr: boolean("zuhr").notNull().default(false),
    asr: boolean("asr").notNull().default(false),
    maghrib: boolean("maghrib").notNull().default(false),
    isha: boolean("isha").notNull().default(false),
    witr: boolean("witr").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("prayer_days_user_id_day_index_idx").on(table.userId, table.dayIndex)],
);

export type User = typeof users.$inferSelect;
export type PrayerDay = typeof prayerDays.$inferSelect;
