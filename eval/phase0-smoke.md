# Phase 0 smoke eval

**Purpose:** smoke-test the ask path (grounding, abstention, superseded handling). Conflicting approved proposals are **out of scope for Phase 0**; “no info” on the cache question is accepted.

**Composition:** 5 answerable / 3 absent / 2 contradictory or superseded (the second is scored as abstain, not as conflict reporting).

## How to run

1. Stack: `docker compose up` so the app is at `http://localhost:3000`.
2. Account: sign in as `test@example.com` (local compose test user). Password is the documented local Better Auth curl example `Password123!`, or override with `EVAL_PASSWORD` when seeding.
3. Project: **Phase 0 Eval** (`765e48ea-095f-4f68-a87f-b99bb2df54b7`). Recreate/update with `node eval/seed-phase0.mjs` or `npm run eval:seed`.
4. Open **Assistant** at `[/app/projects/765e48ea-095f-4f68-a87f-b99bb2df54b7/assistant](http://localhost:3000/app/projects/765e48ea-095f-4f68-a87f-b99bb2df54b7/assistant)` and ask each question, or `POST /ask` with `{ "projectId": "765e48ea-095f-4f68-a87f-b99bb2df54b7", "prompt": "..." }` plus the session cookie and `Origin: http://localhost:3000`.
5. Fill **Result**, **$**, **ms**, and **Error bucket** by hand.

### Seeded project


|              |                                                                |
| ------------ | -------------------------------------------------------------- |
| Project name | Phase 0 Eval                                                   |
| Project id   | `765e48ea-095f-4f68-a87f-b99bb2df54b7`                         |
| Account      | `test@example.com`                                             |
| Assistant    | `/app/projects/765e48ea-095f-4f68-a87f-b99bb2df54b7/assistant` |


### Injection rules (from `src/api/project-service.ts` + `src/llm/decision-context.ts`)

`POST /ask` loads **only** `approved` **decisions** for this project (newest `updatedAt` first, max 20). `superseded`**,** `rejected`**, and** `proposed` **are not stuffed.** The model must answer only from that delimited context.

Every prompt therefore receives the **same approved bundle** (nine rows, including the long inject-path note used only for chunking smoke). The **Note ids stuffed** column lists the ids that matter for scoring that question. Absent rows use `—` because no note states the fact.

Approved bundle (injected on every ask): `31f4dcca-9ebc-4f0f-bc8c-ad24b2a0bebe`, `73b364e1-0307-4021-89c5-4728ab366df3`, `b2c25327-df1c-4d85-a728-d89e1eab6b56`, `fe7d011d-475a-4708-8782-a79850ccfb2b`, `2c42ce46-c03e-43ba-b6a1-972ed13653a8`, `8f8cbc0e-aded-43b7-8d77-ce6ac686a882`, `603a58ca-9379-486e-8a33-66edceb0b07a`, `84da2e9c-8fab-44fb-89fa-21599a6833ac`, plus long note `79c2cff2-3fcc-4bfd-ada6-31205f877fb1` (chunking smoke; not a scored Q1–Q10 target).

Not injected: Gemini `df440996-4d72-40b7-a47f-95079b2594ee` (`superseded`).

### Expected behavior by group


| Group             | Expected Result | What should happen                                                                                                                                                                                            |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Answerable        | `useful`        | Answer matches the stuffed approved note for that topic.                                                                                                                                                      |
| Absent            | `abstain`       | On-topic but not in the stuffed notes. Reply only: “There isn't enough recorded data about this decision.” Do not invent a region, SLA, or on-call roster, and do not use the off-topic “bound to that” line. |
| Superseded LLM    | `useful`        | Only Groq is stuffed (superseded Gemini is not injected). Answer **Groq**. Naming Gemini as current is **wrong** (supersede-leak).                                                                            |
| Conflicting cache | `abstain`       | Both Redis and in-process Map may still be stuffed (both `approved`). Phase 0 does **not** score “report the conflict.” Expected: “There isn't enough recorded data about this decision.” (or equivalent). Conflict handling is deferred. Picking one cache as settled is still wrong. |


## Eval sheet

Leave Result / $ / ms / Error bucket as `—` until you run a turn.

Error bucket examples: `grounding`, `abstain-miss`, `false_absent`, `supersede-leak`, `timeout`, `refusal-over`, `absent_wording`. Phase 0 does not use `conflict-miss` / `false_absent` for Q10 (conflict handling deferred).

### Answerable (5)


| Question                                                           | Result (useful/abstain/wrong) | Note ids stuffed                       | $          | ms   | Error bucket |
| ------------------------------------------------------------------ | ----------------------------- | -------------------------------------- | ---------- | ---- | ------------ |
| Why did we choose PostgreSQL?                                      | useful                        | `31f4dcca-9ebc-4f0f-bc8c-ad24b2a0bebe` | 0.00023175 | 1254 | —            |
| What authentication approach did we choose for humans?             | useful                        | `73b364e1-0307-4021-89c5-4728ab366df3` | 0.0001242  | 566  | —            |
| How are project permissions modeled?                               | useful                        | `b2c25327-df1c-4d85-a728-d89e1eab6b56` | 0.00018967 | 1142 | —            |
| How do we package and run the development stack?                   | useful                        | `fe7d011d-475a-4708-8782-a79850ccfb2b` | 0.00026198 | 1717 | —            |
| Which decision statuses are injected into the assistant /ask path? | useful                        | `2c42ce46-c03e-43ba-b6a1-972ed13653a8` | 0.00011213 | 508  | —            |


### Absent (3)

These facts are **deliberately omitted** from every seeded decision (Compose names localhost and does not choose a cloud region).


| Question                                  | Result (useful/abstain/wrong) | Note ids stuffed | $          | ms   | Error bucket   |
| ----------------------------------------- | ----------------------------- | ---------------- | ---------- | ---- | -------------- |
| Which AWS region will we deploy to?       | abstain                       | —                | 0.00010642 | 636  | absent_wording |
| What is our production uptime SLA?        | abstain                       | —                | 0.00011737 | 665  | —              |
| Who is on the on-call rotation this week? | abstain                       | —                | 0.0001383  | 1007 | absent_wording |


Q6 wording this run: the model replied `My job is this team's decisions and recorded context. I'm bound to that.` Behavior class is still `abstain`, but the template is wrong for an absent on-topic question. Expected: `There isn't enough recorded data about this decision.`

Q8 same miss as Q6: on-call is in-scope project-ops with no notes, so it should use the absent-data line, not the off-topic bound-to-context line.

Observed answers (answers were not pasted for Q1–Q2; marked `useful` as the happy-path answerable set):

- Q3: GitHub-style roles admin/maintain/write/triage/read.
- Q4: Docker Compose stack (postgres, migrate, app), `localhost:3000`.
- Q5: Only `approved` decisions are injected into `/ask`.
- Q7: `There isn't enough recorded data about this decision.` (correct absent template).
- Q8: `My job is this team's decisions and recorded context. I'm bound to that.` (wrong template for on-topic absent).

Model for Q1–Q10: `openai/gpt-oss-20b`.

### Contradictory / superseded (2)


| Question                                                 | Result (useful/abstain/wrong) | Note ids stuffed                                                                                                              | $          | ms  | Error bucket |
| -------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- | --- | ------------ |
| What is the current LLM provider?                        | useful                        | `8f8cbc0e-aded-43b7-8d77-ce6ac686a882` (Groq approved; Gemini `df440996-4d72-40b7-a47f-95079b2594ee` superseded, not stuffed) | 0.00011655 | 582 | — |
| What is the current caching strategy for decision reads? | abstain                       | `603a58ca-9379-486e-8a33-66edceb0b07a` (Redis) + `84da2e9c-8fab-44fb-89fa-21599a6833ac` (in-process Map); both approved       | 0.0001518  | 768 | — |


Q9: `The current LLM provider is Groq.` Gemini superseded id was not stuffed. Still **useful**.

Q10: the model replied `There isn't enough recorded data about this decision.` That is the **Phase 0 expected** result (`abstain`). Both cache notes may still be stuffed; we are **not** scoring “report the Redis vs Map conflict.” Later work will handle conflicting proposals.

### Manual / chunking

Long approved decision **How we structure the /ask inject path** (`79c2cff2-3fcc-4bfd-ada6-31205f877fb1`) exists so ingest can sub-chunk past `MAX_SECTION_CHARS` (2000). After `npm run ingest:chunks -- --projectId 765e48ea-095f-4f68-a87f-b99bb2df54b7` it should write eight `#section:n` rows and no `full` row. Not scored as Q11.

## Findings

Q1–Q5 were all **useful**. Q6–Q8 **abstain**; Q7 used the correct absent template, while Q6 and Q8 used the off-topic “bound to that” line (`absent_wording`). Q9 was **useful** (Groq; superseded Gemini not injected). Q10 is **abstain**: “no info” on caching is accepted. Conflicting approved proposals (Redis vs Map) are out of scope for Phase 0. Model: `openai/gpt-oss-20b`.

## Seeded decisions

Re-run `node eval/seed-phase0.mjs` to upsert. Idempotent: reuses this project by title; updates proposal text and review status by title.


| Key          | Title                                                            | Status                          | Id                                     |
| ------------ | ---------------------------------------------------------------- | ------------------------------- | -------------------------------------- |
| postgres     | Use PostgreSQL as the system of record                           | approved                        | `31f4dcca-9ebc-4f0f-bc8c-ad24b2a0bebe` |
| auth         | Authenticate humans with Better Auth email/password sessions     | approved                        | `73b364e1-0307-4021-89c5-4728ab366df3` |
| roles        | Authorize project access with GitHub-style roles                 | approved                        | `b2c25327-df1c-4d85-a728-d89e1eab6b56` |
| compose      | Package and run Mindvault with Docker Compose                    | approved                        | `fe7d011d-475a-4708-8782-a79850ccfb2b` |
| lifecycle    | Decision records use proposed, approved, rejected, or superseded | approved                        | `2c42ce46-c03e-43ba-b6a1-972ed13653a8` |
| llm-gemini   | Use Google Gemini as the LLM provider                            | superseded (not injected)       | `df440996-4d72-40b7-a47f-95079b2594ee` |
| llm-groq     | Use Groq as the LLM provider                                     | approved                        | `8f8cbc0e-aded-43b7-8d77-ce6ac686a882` |
| cache-redis  | Cache decision reads in Redis                                    | approved (conflicts with Map)   | `603a58ca-9379-486e-8a33-66edceb0b07a` |
| cache-memory | Cache decision reads in an in-process Map                        | approved (conflicts with Redis) | `84da2e9c-8fab-44fb-89fa-21599a6833ac` |
| ask-inject   | How we structure the /ask inject path                            | approved (long; sub-chunk smoke) | `79c2cff2-3fcc-4bfd-ada6-31205f877fb1` |


Not seeded (so absent questions stay absent): AWS region, production SLA, on-call roster.