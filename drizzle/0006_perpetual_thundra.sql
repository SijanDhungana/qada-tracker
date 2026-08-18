CREATE TABLE "quran_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_date" date NOT NULL,
	"surah" integer NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quran_log_user_date_surah_key" UNIQUE("user_id","prayer_date","surah")
);
--> statement-breakpoint
ALTER TABLE "quran_log" ADD CONSTRAINT "quran_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quran_log_user_date_idx" ON "quran_log" USING btree ("user_id","prayer_date");