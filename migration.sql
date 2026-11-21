CREATE TABLE "gathering_votes" (
	"voter_id" text PRIMARY KEY,
	"vote_date" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gathering_vote_allowed_date" CHECK ("vote_date" IN ('2026-12-24', '2026-12-26', '2026-12-31', '2027-01-08'))
);
