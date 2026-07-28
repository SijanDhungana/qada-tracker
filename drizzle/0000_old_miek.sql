CREATE TABLE "prayer_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day_index" integer NOT NULL,
	"day_date" date,
	"fajr" boolean DEFAULT false NOT NULL,
	"zuhr" boolean DEFAULT false NOT NULL,
	"asr" boolean DEFAULT false NOT NULL,
	"maghrib" boolean DEFAULT false NOT NULL,
	"isha" boolean DEFAULT false NOT NULL,
	"witr" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"track_witr" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "prayer_days" ADD CONSTRAINT "prayer_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prayer_days_user_id_day_index_idx" ON "prayer_days" USING btree ("user_id","day_index");