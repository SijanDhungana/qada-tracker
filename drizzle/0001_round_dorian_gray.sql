CREATE TABLE "masjid_prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_date" date NOT NULL,
	"prayer" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "masjid_prayers_user_date_prayer_key" UNIQUE("user_id","prayer_date","prayer")
);
--> statement-breakpoint
ALTER TABLE "prayer_days" ADD COLUMN "fajr_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prayer_days" ADD COLUMN "zuhr_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prayer_days" ADD COLUMN "asr_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prayer_days" ADD COLUMN "maghrib_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prayer_days" ADD COLUMN "isha_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prayer_days" ADD COLUMN "witr_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_goal" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "theme" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "masjid_prayers" ADD CONSTRAINT "masjid_prayers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "masjid_prayers_user_date_idx" ON "masjid_prayers" USING btree ("user_id","prayer_date");