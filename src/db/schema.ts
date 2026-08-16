import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  trackWitr: boolean("track_witr").notNull().default(false),
  /** Prayers per day the user is aiming for — drives the finish-date projection. */
  dailyGoal: integer("daily_goal").notNull().default(2),
  /** "system" | "dark" | "light" */
  theme: text("theme").notNull().default("system"),
  /** IANA zone that defines the midnight-to-midnight day for this account. */
  timezone: text("timezone").notNull().default("America/Toronto"),
  /** Opt-in: adds the night prayer to the Today screen and its history. */
  trackTahajjud: boolean("track_tahajjud").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One row per missed day. The six booleans are the slots; the six matching
 * timestamps record when each slot was logged, which is what every pace and
 * history feature reads. `day_date` stays the ledger's own date.
 */
export const prayerDays = pgTable(
  "prayer_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    dayDate: date("day_date"),
    fajr: boolean("fajr").notNull().default(false),
    zuhr: boolean("zuhr").notNull().default(false),
    asr: boolean("asr").notNull().default(false),
    maghrib: boolean("maghrib").notNull().default(false),
    isha: boolean("isha").notNull().default(false),
    witr: boolean("witr").notNull().default(false),
    fajrAt: timestamp("fajr_at", { withTimezone: true }),
    zuhrAt: timestamp("zuhr_at", { withTimezone: true }),
    asrAt: timestamp("asr_at", { withTimezone: true }),
    maghribAt: timestamp("maghrib_at", { withTimezone: true }),
    ishaAt: timestamp("isha_at", { withTimezone: true }),
    witrAt: timestamp("witr_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("prayer_days_user_id_day_index_idx").on(table.userId, table.dayIndex),
  ],
);

/**
 * Today's congregation record — one row per prayer per calendar day.
 * Separate from the qada ledger: this is about the prayers being prayed now,
 * not the ones being made up.
 */
export const masjidPrayers = pgTable(
  "masjid_prayers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The user's local calendar date, stored as a plain date. */
    prayerDate: date("prayer_date").notNull(),
    /** fajr | zuhr | asr | maghrib | isha */
    prayer: text("prayer").notNull(),
    /** masjid | alone | missed */
    status: text("status").notNull(),
    /** on_time | late — only meaningful when status is "masjid". */
    timing: text("timing"),
    /** rakah-1 … rakah-4 | tashahhud — where the jama'ah was joined when late. */
    joinedRakah: text("joined_rakah"),
    /** Free text or one of the suggested notes; only meaningful when not "masjid". */
    reason: text("reason"),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("masjid_prayers_user_date_idx").on(table.userId, table.prayerDate),
    unique("masjid_prayers_user_date_prayer_key").on(
      table.userId,
      table.prayerDate,
      table.prayer,
    ),
  ],
);

/**
 * The night prayer, kept in its own table rather than folded into
 * masjid_prayers: its answers are about whether it happened at all, not about
 * where it was prayed, and mixing them would corrupt the congregation stats.
 */
export const tahajjudNights = pgTable(
  "tahajjud_nights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    /** prayed | woke | slept */
    status: text("status").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("tahajjud_nights_user_date_key").on(table.userId, table.prayerDate),
  ],
);

export type User = typeof users.$inferSelect;
export type PrayerDay = typeof prayerDays.$inferSelect;
export type MasjidPrayer = typeof masjidPrayers.$inferSelect;
export type TahajjudNight = typeof tahajjudNights.$inferSelect;
