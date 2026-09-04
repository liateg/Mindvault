CREATE TYPE "public"."chunk_kind" AS ENUM('full', 'section');--> statement-breakpoint
CREATE TABLE "decision_chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"decision_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"chunk_kind" "chunk_kind" NOT NULL,
	"section_index" integer,
	"section_count" integer,
	"proposal_slice" text NOT NULL,
	"source_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decision_chunk" ADD CONSTRAINT "decision_chunk_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_chunk" ADD CONSTRAINT "decision_chunk_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_chunk_decision_id_idx" ON "decision_chunk" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "decision_chunk_project_id_idx" ON "decision_chunk" USING btree ("project_id");