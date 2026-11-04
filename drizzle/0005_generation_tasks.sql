CREATE TABLE IF NOT EXISTS "generation_tasks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"task_type" varchar(32) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"current_stage" varchar(32) DEFAULT 'queued' NOT NULL,
	"title" varchar(255) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"difficulty" varchar(32) DEFAULT 'intermediate' NOT NULL,
	"idempotency_key" varchar(64) NOT NULL,
	"input_params_json" text NOT NULL,
	"result_data_json" text,
	"persisted_entity_id" varchar(36),
	"error_message" text,
	"error_category" varchar(64),
	"is_retryable" boolean DEFAULT true NOT NULL,
	"execution_deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_tasks" ADD CONSTRAINT "generation_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_tasks_user_id_idx" ON "generation_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_tasks_user_status_idx" ON "generation_tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_tasks_created_idx" ON "generation_tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_tasks_active_deadline_idx" ON "generation_tasks" USING btree ("status","execution_deadline_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "generation_tasks_active_idempotency_idx" ON "generation_tasks" USING btree ("user_id","idempotency_key") WHERE status IN ('queued', 'processing');
