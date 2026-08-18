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
  /** Also ask how many rak'ahs of tahajjud were prayed. */
  trackTahajjudRakahs: boolean("track_tahajjud_rakahs").notNull().default(false),
  /** Opt-in: a sunnah marker beside each of the five daily prayers. */
  trackSunnah: boolean("track_sunnah").notNull().default(false),
  /** Opt-in: adds the forenoon prayer to the Today screen and its history. */
  trackDuha: boolean("track_duha").notNull().default(false),
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
    /** Only recorded when the user opts in, and only when status is "prayed". */
    rakahs: integer("rakahs"),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("tahajjud_nights_user_date_key").on(table.userId, table.prayerDate),
  ],
);

/**
 * The forenoon prayer. Its own table rather than a row in tahajjud_nights:
 * the two ask different questions (Tahajjud has a "woke without praying"
 * answer that daylight makes meaningless), and merging them would mean a
 * status column whose valid values depend on a sibling column.
 */
export const duhaPrayers = pgTable(
  "duha_prayers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    /** prayed | missed */
    status: text("status").notNull(),
    /** Only recorded on a day it was prayed. */
    rakahs: integer("rakahs"),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("duha_prayers_user_date_key").on(table.userId, table.prayerDate),
  ],
);

/**
 * Today's witr, kept apart from the qada witr slot. The backlog asks "have you
 * made up that night's witr"; this asks "did you pray witr last night", and
 * missing it leaves the door open to making it up.
 */
export const dailyWitr = pgTable(
  "daily_witr",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    /** prayed | missed */
    status: text("status").notNull(),
    /** Missed at its time, but made up afterwards. */
    remade: boolean("remade").notNull().default(false),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("daily_witr_user_date_key").on(table.userId, table.prayerDate),
  ],
);

/**
 * The voluntary rak'ahs around each fard prayer — one row per part, per
 * prayer, per day. Split by part rather than a single yes/no because "prayed
 * the four before but not the two after" is the ordinary case, and collapsing
 * it would throw away the only detail that makes the record worth keeping.
 */
export const sunnahLog = pgTable(
  "sunnah_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    /** fajr | zuhr | asr | maghrib | isha */
    prayer: text("prayer").notNull(),
    /** before | after | nafl — see SUNNAH_PARTS in lib/sunnah.ts */
    part: text("part").notNull(),
    prayed: boolean("prayed").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("sunnah_log_user_date_part_key").on(
      table.userId,
      table.prayerDate,
      table.prayer,
      table.part,
    ),
  ],
);

/**
 * A running tally per kind per day — dhikr, nafl rak'ahs, Qur'an read. One row
 * per kind rather than one per tap, so a hundred taps is a hundred cheap
 * increments of a single row instead of a hundred inserts.
 */
export const worshipLog = pgTable(
  "worship_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    /** See WORSHIP_KINDS in lib/worship.ts */
    kind: text("kind").notNull(),
    count: integer("count").notNull().default(0),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("worship_log_user_date_idx").on(table.userId, table.prayerDate),
    unique("worship_log_user_date_kind_key").on(
      table.userId,
      table.prayerDate,
      table.kind,
    ),
  ],
);

/**
 * Which surahs were read on a day — a set, not a tally.
 *
 * The unique key means reading Al-Ikhlas three times records the surah once:
 * the question this answers is "what did you read today", and counting
 * repetitions would make a short surah read on a loop outrank a long one.
 * Juz stay a plain number in worship_log, where a count is the whole point.
 */
export const quranLog = pgTable(
  "quran_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prayerDate: date("prayer_date").notNull(),
    /** 1–114, validated against SURAHS in lib/quran.ts before it is written. */
    surah: integer("surah").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("quran_log_user_date_idx").on(table.userId, table.prayerDate),
    unique("quran_log_user_date_surah_key").on(
      table.userId,
      table.prayerDate,
      table.surah,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type PrayerDay = typeof prayerDays.$inferSelect;
export type MasjidPrayer = typeof masjidPrayers.$inferSelect;
export type TahajjudNight = typeof tahajjudNights.$inferSelect;
export type DailyWitr = typeof dailyWitr.$inferSelect;
export type SunnahRow = typeof sunnahLog.$inferSelect;
export type WorshipRow = typeof worshipLog.$inferSelect;
