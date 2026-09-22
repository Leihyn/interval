# VERIFY REPORT — PREFLIGHT MODE

```
=======================================
HACKATHON VERIFY — PREFLIGHT REPORT
Project: Interval
Mode: preflight
Time to deadline: ~5h05m (deadline 22 Sep 2026 12:00 PT / 20:00 WAT)
Run date: 2026-09-22
Kill-Zone Escalation: EMERGENCY (3 kill-zones triggered)
=======================================
```

## Degraded inputs (stated plainly, as instructed)

No pipeline skill has ever run on this project. The following inputs did not exist and the
facets that depend on them ran degraded or on substitutes:

| Missing input | Facets affected | Substitute used |
|---|---|---|
| `PULSE.md` | Step 0.5 Downstream Items | Skipped, no ledger exists |
| `.conductor-state.json` | Prerequisite gate | Warned, proceeded out of pipeline |
| `.build-state.json`, `.debug-state.json` | F1 pre-notes, F4 context | None, defaults used |
| `.critique-state.json` | Critique alignment | Elevation check skipped |
| `PRD.md`, `ARCHITECTURE.md` | P0 feature check | The 10 MUSTs in `interval-build-plan.md` |
| `FEATURE-OBSERVABLES.md` | Phase 5 observables | Skipped entirely |
| Convex All Gas brief | F2, F6 | Fetched the official rules page live instead |
| Browser access (Chrome extension unresponsive) | F1 console + UI checks | Backend flow executed via CLI |

**Contract note.** Execution rule 6 says stop at the first kill-zone. The Kill-Zone Severity
Escalation table requires knowing how many kill-zones failed, which is unknowable if you stop at
the first. All eight facets were run so the escalation level could be determined. This is a
deliberate, disclosed deviation.

---

## KILL-ZONES

```
  KZ-1 Demo Reliability:         CLEAR (CONDITIONAL)
  KZ-2 Submission Completeness:  TRIGGERED
  KZ-3 Contract Wrong Network:   N/A (no contracts, not a blockchain project)
  KZ-4 Sponsor Integration:      TRIGGERED (OpenAI, Firecrawl, AgentMail)
  KZ-5 Eligibility Compliance:   TRIGGERED (partner-integration requirement)

OVERALL STATUS: BLOCKED — DO NOT SUBMIT AS CURRENTLY DESCRIBED

WINNER-READINESS: 47/100 (raw; BLOCKED supersedes)

FACET SCORES
  1. Demo Reliability         15/25
  2. Submission Completeness   5/20
  3. Sponsor Integration       5/20
  4. Technical Correctness    11/15
  5. Narrative Quality         6/10
  6. Eligibility Compliance    3/ 5
  7. Code Quality              2/ 3
  8. Presentation Assets       0/ 2

WINNING PATTERN CHECKS (advisory, not scored)
  WP-1 Landing Page:    WARN    — no live URL, could not screenshot
  WP-2 Test Ratio:      FAIL    — 0.29 (4 test files / 14 source files); see note
  WP-3 Multi-Track:     WARN    — 4 sponsors claimed, 1 with real code backing
  WP-4 Submission Dir:  FAIL    — submission/ absent
  WP-5 README Story:    FAIL    — README is still the default Vite template
```

WP-2 note: the raw file ratio is misleading here. Four test files hold 65 tests covering the
entire safety-critical surface. The ratio is reported as the rule defines it, but test depth is
a strength of this project, not a weakness.

---

## The finding that matters most

**The submission description describes a system that was not built.**

`interval-submission.md` is polished and ready to paste. It claims, in the Stack section and
throughout Notable Features:

- *"OpenAI for extraction in both directions"* — there is no OpenAI dependency, no SDK import,
  and no API call anywhere in the codebase. Extraction is a deterministic regex parser.
- *"Firecrawl for the clinical guideline crawl that grounds and cites every drafted item"* —
  zero references to Firecrawl in the source. The citations in `convex/seed.ts` are real NICE
  URLs typed by hand.
- *"AgentMail for the two-way patient inbox, which is the entire patient-facing interface"* —
  three occurrences, all of them a route path string and comments. No SDK, no call, no email
  ever sent or received.
- *"The language model turns free text into typed fields"* — it does not. `convex/parse.ts` does.
- *"Convex ... auth, crons"* — neither is built.

The build plan's fallbacks were the right call under the time available, and the code that
exists is honest. The description was written on 12 Sep against the plan, not against the
build, and was never reconciled. Pasting it as-is would claim three integrations that do not
exist.

---

## Facet Details

### Facet 1 — Demo Reliability: 15/25 (KZ-1 CLEAR, conditional)

Five-run test executed for real, each run from a clean reseed (`seed:demo` wipes every table):

```
Run 1: SUCCESS (items=4, level=RED, safetyReply=yes, boardTop=RED)
Run 2: SUCCESS (items=4, level=RED, safetyReply=yes, boardTop=RED)
Run 3: SUCCESS (items=4, level=RED, safetyReply=yes, boardTop=RED)
Run 4: SUCCESS (items=4, level=RED, safetyReply=yes, boardTop=RED)
Run 5: SUCCESS (items=4, level=RED, safetyReply=yes, boardTop=RED)
PASS COUNT: 5/5
```

Flow tested: board loads with 4 items, patient reply `BP 186/104 today, bit of a headache` is
ingested, triage returns RED with the hypertensive-crisis reason, the fixed safety auto-reply is
returned, and the check-in lands at the top of the board.

Why not 25: this was the backend flow driven through the Convex CLI against a **local**
deployment, not the flow a judge follows in a browser against a public URL. The React board has
never been observed rendering. Base reduced to 20 for the substitute flow, then −3 (endpoint is
`127.0.0.1`, no deployed environment exists) and −2 (console errors could not be checked).

KZ-1 is CLEAR because the flow does not fail. **Condition: re-run this five-run test in a browser
against the deployed convex.site URL before submitting.** Until then F1 carries low confidence.

### Facet 2 — Submission Completeness: 5/20 (KZ-2 TRIGGERED)

```
2.2 Required fields drafted: 2/6  — 4 required fields have no content at all
2.3 URLs accessible:         0/5  — GitHub 404, no demo URL, no video
2.4 Team confirmed:          2/4  — solo + team name set; vibeapps.dev registration unconfirmed
2.5 Prize tracks correct:    1/3  — tags claim 3 sponsors that are not integrated
2.6 Submission readiness:    0/2  — no submission/ directory, nothing staged
```

Required fields with no content: **App Website Link**, **GitHub Repo URL**, **Video Demo**,
**Screenshot or Image**. The prose fields (title, tagline, name, email, team, tags, description)
are all drafted and of good quality.

Official rules, fetched live and quoted verbatim:
- *"Judges can open what you built. Publish on convex.site or chatgpt.site. No localhost demos."*
- *"All GitHub repos must be public to qualify."*
- Video: *"Under 3 minutes. Talk less, click through the real product."* Mandatory.

### Facet 3 — Sponsor Integration Depth: 5/20 (KZ-4 TRIGGERED)

Four sponsors claimed, so 5 points each. ABCD verification run against the real codebase:

| Sponsor | A import | B call | C value | D requirement | Score | KZ-4 |
|---|---|---|---|---|---|---|
| Convex | yes | yes | yes | yes | 5/5 | no |
| OpenAI | no | no | no | no | 0/5 | **YES** |
| Firecrawl | no | no | no | no | 0/5 | **YES** |
| AgentMail | no | no | no | no | 0/5 | **YES** |

Evidence: `package.json` runtime dependencies are `@convex-dev/static-hosting`, `convex`, `react`,
`react-dom`. Nothing else. Grep counts in source: openai 1 file (a comment), firecrawl 0 files,
agentmail 3 (a route path plus comments).

Convex scores 4/4 legitimately: schema with indexes, queries, mutations, httpRouter with an
httpAction, live `useQuery` subscriptions, a registered component, and static hosting. Note that
the judging criteria name *"Convex depth (queries, mutations, live updates, auth)"* and **auth is
not built**, which costs depth points with judges even though it does not trigger a kill-zone.

### Facet 4 — Technical Correctness: 11/15

```
Tests pass (65/65, 4 files):     4/4
Deployed + reachable:            0/3  — no deployment exists
Frontend build clean:            3/3  — tsc -b and vite build both clean
No hardcoded local values:       3/3  — committed source clean, .env.local gitignored
API keys in prod:                1/2  — none required as built; no prod environment
```

### Facet 5 — Narrative Quality: 6/10

This is not a blockchain hackathon, so 5.3 was adapted from "why blockchain" to "why this stack".

```
One-sentence pitch:   2/3  — tagline is specific and strong; "powered by" clause is false for 3 of 4
Problem statement:    3/3  — genuinely excellent, see below
Why this stack:       1/2  — live sync and email-as-interface justify Convex; a plain backend could do much of it
Sponsor fit:          0/2  — the justification is well written but describes integrations that do not exist
```

The problem statement is the strongest asset in this submission and should not be touched:
forty minutes clerking, five minutes on the plan, then silence until the patient walks back in,
and when they are no better the two possible causes demand opposite responses with no signal to
tell them apart. That passes all three specificity tests.

### Facet 6 — Eligibility Compliance: 3/5 (KZ-5 TRIGGERED)

```
6.1 Team size valid:        1/1  — solo, permitted
6.2 Originality confirmed:  1/1  — first commit 2026-09-12, after the 25 Aug 12:00 PT cutoff
6.3 Members registered:     0/1  — vibeapps.dev registration not confirmed, USER MUST VERIFY
6.4 Track rules + facts:    0/1  — VIOLATION, see below
6.5 License present:        1/1  — no license requirement found in the rules
```

Deadline confirmed against the official page: *"Submissions are due Sep 22, 12:00 PM PT."* The
stored deadline was correct.

**The violation.** Official rules: *"Each submission must include Convex and use hackathon cohost
or partner integrations."* The cohosts are OpenAI, Firecrawl and AgentMail. Interval uses none of
them. The rules further state the sponsor tools must do *"real work"* and *"cannot merely appear
in documentation."* A route path named `/agentmail/inbound` with no SDK behind it is exactly the
case that language excludes.

Separately, *"All GitHub repos must be public to qualify."* There is no remote configured, so no
repo exists at all.

### Facet 7 — Code Quality: 2/3

```
No secrets in repo:       1/1  — 0 env files tracked, .env.local gitignored
README accurate:          0/1  — README.md is still "# React + TypeScript + Vite" boilerplate
Build clean, no log spam: 1/1  — 0 console.log in src or convex
```

### Facet 8 — Presentation Assets: 0/2

```
Demo video complete:  0/1  — does not exist; mandatory and under 3 minutes
Visual assets:        0/1  — no screenshots, no cover image
```

---

## P0 Feature Check (degraded: no PRD, used the plan's 10 MUSTs)

| # | MUST | Status |
|---|---|---|
| 1 | convex.site deploy + public repo + hackathon.md | NOT-BUILT (hackathon.md only) |
| 2 | Auth, two staff roles | NOT-BUILT |
| 3 | Patient record + clerking note paste | BUILT-UNTESTED (schema and mutation exist, no UI) |
| 4 | OpenAI drafting with crawled citation | NOT-BUILT |
| 5 | Approval gate enforced in the mutation | BUILT-AND-TESTED |
| 6 | AgentMail outbound | NOT-BUILT |
| 7 | AgentMail inbound | BUILT-UNTESTED (adapter written, never exercised) |
| 8 | Live board ordered by level | BUILT-AND-TESTED (query); UI layer unobserved |
| 9 | Red-flag path end to end | BUILT-AND-TESTED in-app; email leg NOT-BUILT |
| 10 | Unit-typed vitals, UNRESOLVED to AMBER | BUILT-AND-TESTED |

`p0_built_and_tested = 4 / 10 = 40%`. Below the 60% floor, which independently forces
**DO-NOT-SUBMIT** under the Post-Build rule.

Phase 5 observable verification: SKIPPED, `FEATURE-OBSERVABLES.md` does not exist.
Critique alignment: SKIPPED, `.critique-state.json` does not exist.
Blind cross-review helper: NOT RUN, disclosed rather than claimed.

---

## Action Items

### BLOCKED — must fix before submitting

1. **Integrate at least one partner (OpenAI, Firecrawl or AgentMail) so it does real work.**
   Without this the entry is ineligible, not merely weak. Cheapest by a wide margin is OpenAI:
   `convex/parse.ts` already produces the exact typed shape an extraction action would return, so
   an action that calls OpenAI and merges over the deterministic parse is a contained change. It
   also makes the description's central claim true instead of false. Needs an API key.
2. **Deploy to convex.site.** Blocked on `npx convex login`, in flight with the user.
3. **Create and push a public GitHub repo.** Rules: no private repos qualify.
4. **Rewrite the submission Description to match what exists.** Remove or correct every claim about
   integrations that are not built. This is not optional polish; it is the difference between an
   honest submission and a false one.
5. **Record the demo video.** Under 3 minutes, mandatory.

### TRIAGE ORDER (adapted, KZ-1 is clear so the standard order shifts)

1. Partner integration (KZ-5, eligibility, binary pass or fail)
2. Deploy + public repo (KZ-2, also eligibility)
3. Honest description rewrite (KZ-4 and integrity)
4. Video (KZ-2, mandatory field)
5. Screenshots, README rewrite

### Viability estimate (required by EMERGENCY escalation)

| Item | Estimate |
|---|---|
| Deploy after login | 20 min |
| Public repo | 10 min |
| One OpenAI integration, wired and tested | 50 min (requires a key) |
| Description rewrite | 20 min |
| README rewrite | 15 min |
| Video under 3 min | 50 min |
| Screenshots | 15 min |
| **Total** | **~3h00m of ~5h05m remaining (59%)** |

The rule says fixes exceeding 50% of remaining time warrant DO NOT SUBMIT. The computed figure is
59%, so the rule's output is DO NOT SUBMIT. My judgment differs in one respect and it is recorded
here rather than hidden: the work is well understood and sequential rather than exploratory, and
it becomes achievable if an OpenAI API key is available immediately. **If no partner key can be
obtained, the entry cannot qualify and the honest call is not to submit.**

### SHIP-WITH-FIXES (only after the blocked list clears)

- Add Convex auth. It is a named judging sub-criterion under "Convex depth" and is absent.
- Add a `submission/` directory with screenshots, links and video URL staged.
- Keep the problem statement exactly as written.

### SUBMIT AS-IS (acceptable)

- The triage engine, the 65 tests, and the safety invariants. This is the strongest part of the
  project and it is real, executed and reproducible.
- The problem statement and tagline.

### ONE-SENTENCE PITCH (5.1, corrected to what is built)

"Interval lets a discharged patient report their home programme, medication and vitals by replying
to an ordinary email, so the clinic sees a deterministically triaged check-in on a live board the
same day instead of hearing nothing for two weeks, powered by Convex."

### DEMO FLOW (confirmed working, backend layer, 5/5)

1. Board loads with the demo patient and four home items, one left unapproved
2. Press "Try to send unapproved" and watch the mutation refuse it
3. Paste `BP 186/104 today, bit of a headache` and watch it land at the top of the board as RED
4. Paste `BP 120/80 but I have chest pain when I walk upstairs` and watch a normal reading still
   go RED on the raw-text scan

---

## Milestone History

No prior milestone checks. This is the first verify run on this project, and the first pipeline
skill of any kind to run on it.

## Debug Integration

No DEBUG-REPORT.md exists. Not run.

```
=======================================
RECOMMENDATION: BLOCKED — 3 kill-zones (KZ-2, KZ-4, KZ-5), EMERGENCY escalation.
Do not submit as currently described. The eligibility gap (zero partner
integrations) and the description claiming three integrations that do not
exist are both fixable in the time remaining IF a partner API key is
available now. If none is, the entry cannot qualify.
=======================================
```
