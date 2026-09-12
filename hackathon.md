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
