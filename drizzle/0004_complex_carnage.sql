CREATE TABLE "daily_witr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_date" date NOT NULL,
	"status" text NOT NULL,
	"remade" boolean DEFAULT false NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_witr_user_date_key" UNIQUE("user_id","prayer_date")
);
--> statement-breakpoint
CREATE TABLE "sunnah_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_date" date NOT NULL,
	"prayer" text NOT NULL,
	"prayed" boolean NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sunnah_log_user_date_prayer_key" UNIQUE("user_id","prayer_date","prayer")
);
--> statement-breakpoint
CREATE TABLE "worship_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_date" date NOT NULL,
	"kind" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worship_log_user_date_kind_key" UNIQUE("user_id","prayer_date","kind")
);
--> statement-breakpoint
ALTER TABLE "tahajjud_nights" ADD COLUMN "rakahs" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "track_tahajjud_rakahs" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "track_sunnah" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_witr" ADD CONSTRAINT "daily_witr_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunnah_log" ADD CONSTRAINT "sunnah_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worship_log" ADD CONSTRAINT "worship_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "worship_log_user_date_idx" ON "worship_log" USING btree ("user_id","prayer_date");