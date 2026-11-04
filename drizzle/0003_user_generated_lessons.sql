CREATE TABLE IF NOT EXISTS "user_generated_lessons" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"conversation_id" varchar(36),
	"title" varchar(255) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"difficulty" varchar(32) DEFAULT 'intermediate' NOT NULL,
	"estimated_minutes" integer DEFAULT 20 NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"prerequisites" text DEFAULT '[]' NOT NULL,
	"learning_objectives" text DEFAULT '[]' NOT NULL,
	"content_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_generated_lessons" ADD CONSTRAINT "user_generated_lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_generated_lessons" ADD CONSTRAINT "user_generated_lessons_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_gen_lessons_user_id_idx" ON "user_generated_lessons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_gen_lessons_user_updated_idx" ON "user_generated_lessons" USING btree ("user_id","updated_at");
