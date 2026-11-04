CREATE TABLE IF NOT EXISTS "user_quizzes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"lesson_id" varchar(36),
	"title" varchar(255) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"difficulty" varchar(32) DEFAULT 'medium' NOT NULL,
	"question_count" integer NOT NULL,
	"question_types" text DEFAULT '["single_choice"]' NOT NULL,
	"questions_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_attempts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"quiz_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"score" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"percentage" integer NOT NULL,
	"time_taken_seconds" integer,
	"answers_json" text NOT NULL,
	"results_json" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_quizzes" ADD CONSTRAINT "user_quizzes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_quizzes" ADD CONSTRAINT "user_quizzes_lesson_id_user_generated_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."user_generated_lessons"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_user_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."user_quizzes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_quizzes_user_id_idx" ON "user_quizzes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_quizzes_lesson_id_idx" ON "user_quizzes" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_quizzes_user_updated_idx" ON "user_quizzes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_attempts_quiz_id_idx" ON "quiz_attempts" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_attempts_user_id_idx" ON "quiz_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_attempts_user_completed_idx" ON "quiz_attempts" USING btree ("user_id","completed_at");
