CREATE TABLE IF NOT EXISTS "ai_conversations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"title" varchar(255) DEFAULT 'New Conversation' NOT NULL,
	"mode" varchar(32) DEFAULT 'general_qa' NOT NULL,
	"lesson_id" varchar(64),
	"section_id" varchar(64),
	"exercise_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_messages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"conversation_id" varchar(36) NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"model" varchar(64),
	"is_simulated" boolean DEFAULT false NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_user_updated_idx" ON "ai_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_conv_id_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_conv_created_idx" ON "ai_messages" USING btree ("conversation_id","created_at");
