CREATE TABLE "duha_prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_date" date NOT NULL,
	"status" text NOT NULL,
	"rakahs" integer,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duha_prayers_user_date_key" UNIQUE("user_id","prayer_date")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "track_duha" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "duha_prayers" ADD CONSTRAINT "duha_prayers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;