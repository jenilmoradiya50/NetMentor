CREATE TABLE "flashcard_progress" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"card_id" varchar(36) NOT NULL,
	"deck_id" varchar(36) NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"next_review_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcard_progress_user_card_unique" UNIQUE("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"deck_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"card_type" varchar(32) DEFAULT 'basic' NOT NULL,
	"front_markdown" text NOT NULL,
	"back_markdown" text NOT NULL,
	"cloze_data" text,
	"tags" text,
	"source_note_id" varchar(64),
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcards_deck_note_ord_unique" UNIQUE("deck_id","source_note_id","order_index")
);
--> statement-breakpoint
CREATE TABLE "imported_decks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"source_type" varchar(32) DEFAULT 'anki_apkg' NOT NULL,
	"source_name" varchar(255) NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"deck_name" varchar(128) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"card_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imported_decks_user_source_hash_unique" UNIQUE("user_id","source_hash")
);
--> statement-breakpoint
ALTER TABLE "flashcard_progress" ADD CONSTRAINT "flashcard_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_progress" ADD CONSTRAINT "flashcard_progress_card_id_flashcards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_progress" ADD CONSTRAINT "flashcard_progress_deck_id_imported_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."imported_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deck_id_imported_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."imported_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_decks" ADD CONSTRAINT "imported_decks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcard_progress_user_deck_status_idx" ON "flashcard_progress" USING btree ("user_id","deck_id","status");--> statement-breakpoint
CREATE INDEX "flashcard_progress_user_next_review_idx" ON "flashcard_progress" USING btree ("user_id","next_review_at");--> statement-breakpoint
CREATE INDEX "flashcards_deck_id_idx" ON "flashcards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "flashcards_user_id_idx" ON "flashcards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "flashcards_deck_order_idx" ON "flashcards" USING btree ("deck_id","order_index");--> statement-breakpoint
CREATE INDEX "imported_decks_user_id_idx" ON "imported_decks" USING btree ("user_id");