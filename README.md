# Interval

**Live:** https://fearless-swordfish-992.convex.site

A patient leaves clinic with three things: a home exercise programme, a drug chart, and an
instruction to check something daily. Then the clinic hears nothing.

Two weeks later they come back no better, and nobody can tell whether the plan was wrong or was
never followed. Those two failures need opposite responses, and the data that would separate them
does not exist, because collecting it has always meant asking the patient to install something.
The patients who most need it will not.

They will reply to an email.

## What it does

A clinician issues a home item. The patient executes it unobserved and reports back by replying to
an ordinary email. That reply is stored raw, scanned for red flags, read into typed fields,
triaged by code against a threshold table, and posted to a board the clinic is already watching. A
reading that breaches a threshold moves to the top the moment it arrives.

One primitive carries three payloads. An exercise item reports adherence and pain. A medication
item reports taken or missed plus side effects. A vital item reports a number with a unit.

## Quick start

```bash
npm install
npx convex dev          # creates a deployment and generates types
npx convex run seed:demo '{}'
npm run dev
```

Open the board, type a reply into the patient box, and watch it triage. Try
`BP 186/104 today, bit of a headache`.

To use OpenAI extraction as well as the deterministic parser:

```bash
npx convex env set OPENAI_API_KEY sk-...
```

Without that key everything still works. See "The model is optional" below.

## How it works

### The model extracts, code triages

The obvious build lets a model read a reply and decide how urgent it is. That is one prompt and it
works most of the time. Most of the time is the wrong bar when the output decides whether a
clinician sees a reading today.

So the two halves are kept apart. `convex/extract.ts` asks the model only to read values out of
prose. Its prompt contains no threshold, no severity level and no notion of urgency.
`convex/triage.ts` then decides the level from those typed values against a table you can read line
by line and argue with.

### The model is optional, and cannot overwrite the parser

`convex/parse.ts` reads the same values deterministically. `convex/merge.ts` takes a model value
**only where the parser produced nothing**, so a hallucinated number can never replace one the
regex read correctly out of the text.

Every failure mode falls through to the parser: no key configured, HTTP error, malformed JSON, or
an exception. The pipeline never stops because the model did.

### The red-flag scan runs on the raw reply

The keyword scan in `convex/triage.ts` runs on the unparsed body, before anything is extracted, so
an extraction failure cannot swallow a red flag. The final level is the maximum of the keyword scan
and the threshold check.

This is the property worth seeing. `BP 120/80 but I have chest pain when I walk upstairs` is a
perfectly normal blood pressure and it still escalates to RED.

### Every vital carries its unit, and nothing is converted

Thresholds are defined per unit. Glucose and temperature each get two rows, one per unit, rather
than one row and a conversion.

A threshold table written in Fahrenheit silently ignores a reported fever of 39. That is a miss
rather than a false alarm, and misses are the failure direction a clinical tool cannot have.

The model may report a unit the patient literally wrote, but may never choose one. If what the
patient wrote disagrees with the unit the clinician issued, the reading resolves to unresolved
rather than being converted. Unresolved escalates to AMBER. It never passes as normal.

### Nothing reaches a patient without clinician approval

The gate is a function the mutation calls, not a disabled button. `convex/gate.ts` throws on a
draft item, so a caller bypassing the interface is refused too. The board has a "try to send
unapproved" button that produces the real refusal.

Exactly two auto-replies exist: an acknowledgement, and a fixed safety string. Nothing generated is
ever sent to a patient, and a question about a medication is routed to a human rather than
answered.

## Thresholds

Placeholders sourced from published guidance. **They must be confirmed and cited by a clinician
before any clinical use.**

| Vital | Unit | RED | AMBER |
|---|---|---|---|
| Blood pressure | mmHg | sys >= 180 or dia >= 120, or sys < 90 | sys >= 160 or dia >= 100 |
| Blood glucose | mg/dL | < 70 or > 300 | outside clinician-set target |
| Blood glucose | mmol/L | < 3.9 or > 16.7 | outside clinician-set target |
| Temperature | C | >= 39.0 | >= 38.0 |
| Temperature | F | >= 102.2 | >= 100.4 |
| SpO2 | % | < 92 | 92 to 94 |

Crisis thresholds are near-universal across guideline bodies. Staging thresholds are
jurisdictional. So the choice of guideline body drives the AMBER band rather than the RED one.

## Tests

```bash
npm test
```

74 tests. They are written around misses rather than false alarms, because a reply that should
have escalated and did not is the failure that matters. One test asserts that 39 read against a
Fahrenheit table is GREEN while 39 C is RED, which is the exact miss the two-row table prevents.

## Convex usage

Schema with indexes, queries, mutations, actions, an `httpRouter` with an `httpAction` for the
inbound email webhook, live `useQuery` subscriptions driving the board, and static hosting serving
the frontend from the same deployment at `convex.site`.

## Troubleshooting

**The board is empty**
Nothing is seeded. Run `npx convex run seed:demo '{}'`, or press "Reset demo patient".

**"Not connected to Convex"**
The build has no `VITE_CONVEX_URL`. Run `npx convex dev` once, then rebuild.

**Every check-in comes back AMBER with "could not be matched to an open item"**
The reply did not match any issued item. Items in `draft` status are never matched, by design.
Approve and issue one first.

**`process` is not defined when deploying**
`npx convex deploy` typechecks with `convex/tsconfig.json`, which is a different file from
`tsconfig.app.json`. Node types are needed in both.

**Extraction seems to do nothing**
That is the designed fallback, not a failure. Check `extractionSource` on the check-in: `parser`
means the model was not used, because no key is set or the call failed.

## Scope

Synthetic patient records only. **This is not a monitoring service and not an emergency channel.**
No compliance claims are made.

Built for the Convex All Gas Hackathon. The build log, including what was not finished and why, is
in `hackathon.md`.
