# Interval: build log

**Convex All Gas Hackathon.** Started 12 September 2026.

A clinic board that closes the gap between discharge and the next appointment. A clinician
issues a home item, the patient executes it unobserved, and the patient reports back by
replying to an email. The reply becomes a structured record, gets triaged, and lands on a
live board the same day. The patient installs nothing.

One primitive, three payloads: an exercise item reports adherence and pain, a medication
item reports taken or missed plus side effects, a vital item reports a number with a unit.

## Stack

- **Convex** database, queries and mutations, live subscriptions, auth, crons, and static hosting on convex.site
- **OpenAI** extraction in both directions: clerking note to drafted items, free-text reply to typed fields
- **Firecrawl** crawls the clinical guideline source that grounds and cites every drafted item
- **AgentMail** the two-way patient inbox, which is the entire patient-facing interface

## Design commitments made before any code

Written down first because they are the parts that cannot be improvised late.

1. The model extracts, code triages. The model never sees a threshold and never assigns a severity level.
2. The red-flag scan runs on the raw reply body, so an extraction failure cannot swallow a red flag.
3. Unresolved never means fine. An unresolvable unit or value escalates rather than passing as normal.
4. Nothing reaches a patient without clinician approval, enforced in the mutation rather than the interface.
5. No auto-reply ever contains generated clinical content. Exactly two exist: an acknowledgement, and a fixed safety string.
6. A medication question is routed to a human, never answered.
7. Every vital carries an explicit unit. Thresholds are defined per unit, never converted at read time.

Commitment 7 exists because a threshold table written in Fahrenheit silently ignores a
reported fever of 39. That is a miss rather than a false alarm.

## Log

### 12 Sep, day 1

Scaffolded Vite + React + TypeScript and installed `convex` and
`@convex-dev/static-hosting`. Chose Vite over Next because static hosting serves a built
directory and Next SSR cannot run there.

Today is a deploy gate and nothing else: prove an empty app reaches a `convex.site` URL
before writing product code. It is the only step in the plan with no fallback, so it goes
first.

### 13 to 21 Sep, the gap

Nothing was built. The plan allocated thirteen days and day 1 was the only one worked. This is
recorded rather than smoothed over, because the shape of what shipped is a direct consequence of it.

### 22 Sep, deadline day

Roughly five hours before the deadline, with none of the four sponsor API keys configured. The
build plan anticipated this and wrote down two fallbacks, both of which are now the shipped path:

- **Extraction.** Instead of OpenAI turning free text into typed fields, a deterministic parser
  reads the structured reply line the plan specified, `done 2/3, pain 6, BP 140/90`, and degrades
  to labelled-number and keyword matching on ordinary prose.
- **Inbound email.** Instead of AgentMail delivering the reply, a paste box on the board calls the
  same `ingestReply` mutation the webhook adapter calls. The email transport is an adapter, not a
  dependency, so the triage path being demonstrated is the triage path that would run in
  production.

What this means honestly: **the email round trip is not live.** The webhook handler is written and
routed at `/agentmail/inbound`, and it will work when a key exists, but no email has gone through
it. The video must say so.

What is real, and how it was checked:

- **The triage engine.** 65 unit tests, all passing under `npm test`. The tests are written around
  misses rather than false alarms, because a reply that should have escalated and did not is the
  failure this cannot have. Invariant 7 has a test asserting that 39 read against a Fahrenheit
  table is GREEN while 39 C is RED, which is the exact miss the two-row threshold table prevents.
- **The invariants are code, not prose.** The approval gate is a function the mutation calls, so
  the board's "try to send unapproved" button produces a real refusal rather than a disabled
  control. The red-flag scan runs on the raw body before anything is parsed.
- **The pipeline runs.** The backend is deployed and every function was exercised directly against
  it with `npx convex run`. A reply reading `BP 120/80 but I have chest pain when I walk upstairs`
  returns RED with reasons `Red-flag wording in the reply: chest pain` and
  `Blood pressure 120/80 mmHg`. A normal reading, escalated on the raw text alone. That is
  invariant 2 working, observed rather than asserted.

Two bugs were found by running the thing rather than by reading it, both in routing a reply to the
item it answers. `done 2/3` was parsed as a blood pressure of 2 over 3 and discarded the real
reading later in the line; then, once that was fixed, a bare `/` in the blood-pressure keyword list
routed `Did 3/3 sets` to the blood-pressure item and triaged an exercise reply against
cardiovascular thresholds. Both now have tests. The matcher was pulled into `convex/match.ts` to
make it testable without Convex types, and it returns null rather than guessing when the wording is
ambiguous across two open items, which lands the reply at AMBER with the raw text shown.

Still not done: the `convex.site` deployment, which needs an account login, and therefore the
required submission field. Auth, Firecrawl citation crawling and the cron-driven missed check-in
escalation are not built. The guideline citations on the demo items are real URLs typed by hand,
not crawled.
