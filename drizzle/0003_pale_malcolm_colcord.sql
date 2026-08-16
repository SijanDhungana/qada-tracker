CREATE TABLE "tahajjud_nights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_date" date NOT NULL,
	"status" text NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tahajjud_nights_user_date_key" UNIQUE("user_id","prayer_date")
);
--> statement-breakpoint
ALTER TABLE "masjid_prayers" ADD COLUMN "timing" text;--> statement-breakpoint
ALTER TABLE "masjid_prayers" ADD COLUMN "joined_rakah" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "track_tahajjud" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tahajjud_nights" ADD CONSTRAINT "tahajjud_nights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;