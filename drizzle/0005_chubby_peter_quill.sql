ALTER TABLE "sunnah_log" DROP CONSTRAINT "sunnah_log_user_date_prayer_key";--> statement-breakpoint
ALTER TABLE "sunnah_log" ADD COLUMN "part" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sunnah_log" ADD CONSTRAINT "sunnah_log_user_date_part_key" UNIQUE("user_id","prayer_date","prayer","part");