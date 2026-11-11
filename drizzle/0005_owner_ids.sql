-- Login: Better Auth tables, the table of sent login emails and an owner for every contact and group.
-- The tables and indexes are generated; the owner steps in the middle are written by hand:
-- owner_id is added without NOT NULL, the existing rows are given to the owner, and only then
-- the column becomes NOT NULL. Drizzle runs the whole file in one transaction, so a failure at
-- any step leaves the database as it was.
CREATE TABLE "login_email_sends" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_email_sends_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"link_identifier" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "groups_name_normalized_idx";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_email_sends_email_sent_at_idx" ON "login_email_sends" USING btree ("email","sent_at");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
-- Give every existing contact and group to the owner. The email comes from the Postgres setting
-- app.owner_email, which src/db/migrate.ts sets from OWNER_EMAIL on this very connection.
-- Notes and group links belong to the owner through their contact, so they need no change.
-- Rows are only updated (owner_id), never deleted.
DO $$
DECLARE
	owner_email text := lower(btrim(coalesce(current_setting('app.owner_email', true), '')));
	owner_user_id text;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM "contacts") AND NOT EXISTS (SELECT 1 FROM "groups") THEN
		RETURN;
	END IF;
	IF owner_email = '' THEN
		RAISE EXCEPTION 'OWNER_EMAIL is not set: it is needed to give the existing contacts and groups to their owner';
	END IF;
	IF owner_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' THEN
		RAISE EXCEPTION 'OWNER_EMAIL is not an email address: %', owner_email;
	END IF;
	SELECT "id" INTO owner_user_id FROM "users" WHERE "email" = owner_email;
	IF owner_user_id IS NULL THEN
		owner_user_id := gen_random_uuid()::text;
		INSERT INTO "users" ("id", "name", "email", "email_verified") VALUES (owner_user_id, '', owner_email, true);
	END IF;
	UPDATE "contacts" SET "owner_id" = owner_user_id WHERE "owner_id" IS NULL;
	UPDATE "groups" SET "owner_id" = owner_user_id WHERE "owner_id" IS NULL;
END $$;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contacts_owner_id_idx" ON "contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_owner_name_normalized_idx" ON "groups" USING btree ("owner_id",replace(lower("name"), 'ё', 'е'));
