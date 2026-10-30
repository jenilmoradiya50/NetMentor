CREATE TABLE "external_references" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"lesson_id" varchar(36),
	"topic_id" varchar(36),
	"title" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"relevant_section" varchar(128),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"target_cert" varchar(32) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_paths_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"topic_id" varchar(36) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(128) NOT NULL,
	"summary" text NOT NULL,
	"content_markdown" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"identifier" varchar(128) NOT NULL,
	"failed_attempts" integer DEFAULT 1 NOT NULL,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "login_rate_limits_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"path_id" varchar(36) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"estimated_minutes" integer DEFAULT 15 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"lesson_id" varchar(36) NOT NULL,
	"mastery_level" varchar(20) DEFAULT 'not_started' NOT NULL,
	"confidence_score" integer DEFAULT 1 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"notes" text,
	CONSTRAINT "user_progress_lesson_id_unique" UNIQUE("lesson_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" varchar(45)
);
--> statement-breakpoint
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_references" ADD CONSTRAINT "external_references_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_references_lesson_id_idx" ON "external_references" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "external_references_topic_id_idx" ON "external_references" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "lessons_topic_id_idx" ON "lessons" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "login_rate_limits_identifier_idx" ON "login_rate_limits" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "topics_path_id_idx" ON "topics" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "user_progress_lesson_id_idx" ON "user_progress" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");