CREATE TYPE "public"."decision_status" AS ENUM('proposed', 'approved', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('admin', 'maintain', 'write', 'triage', 'read');--> statement-breakpoint
CREATE TABLE "decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"proposal_content" text NOT NULL,
	"status" "decision_status" DEFAULT 'proposed' NOT NULL,
	"proposer_user_id" text NOT NULL,
	"reviewer_user_id" text,
	"reviewed_at" timestamp,
	"llm_reasoning_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_member" (
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "project_role" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_member_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_proposer_user_id_user_id_fk" FOREIGN KEY ("proposer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_project_status_idx" ON "decision" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "decision_proposer_user_id_idx" ON "decision" USING btree ("proposer_user_id");--> statement-breakpoint
CREATE INDEX "decision_reviewer_user_id_idx" ON "decision" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "project_owner_user_id_idx" ON "project" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_member_user_id_idx" ON "project_member" USING btree ("user_id");