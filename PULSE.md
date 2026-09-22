# PULSE — Interval

> Created by hackathon-verify (preflight), 2026-09-22. First pipeline skill to run on this
> project. No intel, forge, critique, build, wire, debug or package ran before it.

## Active Facts

- Venue: Convex All Gas Hackathon. Deadline **22 Sep 2026 12:00 PT / 20:00 WAT**, confirmed
  live against https://www.convex.dev/hackathons/all-gas (was not taken from cache).
- Prizes: $10,000 / $5,000 / $1,500.
- **Eligibility rule, verbatim:** *"Each submission must include Convex and use hackathon cohost
  or partner integrations."* Cohosts: OpenAI, Firecrawl, AgentMail. Sponsor tools must do
  *"real work"* and *"cannot merely appear in documentation."*
- **"All GitHub repos must be public to qualify."**
- **"Judges can open what you built. Publish on convex.site or chatgpt.site. No localhost demos."**
- Video mandatory, *"Under 3 minutes. Talk less, click through the real product."*
- Originality cutoff: apps started on or after 25 Aug 12:00 PT. Interval's first commit is
  2026-09-12, so it qualifies.
- Judging criteria: everyday usefulness, creativity, Convex depth (queries, mutations, live
  updates, **auth**), active sponsor integration, live accessibility, social proof, video quality.
- No hackathon brief exists at `~/.claude/skills/hackathon-briefs/`. Worth writing one if this
  project continues.
- Build state: Convex backend and clinic board built. 65 unit tests pass. Backend flow verified
  5/5 against a local deployment. React UI has never been observed rendering.

## Blockers for Downstream

1. **KZ-5, eligibility.** Zero partner integrations. This is a qualify/not-qualify gate, not a
   scoring penalty. Cheapest fix is OpenAI: `convex/parse.ts` already emits the exact typed shape
   an extraction action would return, so an action can merge over it. Requires an API key.
2. **KZ-2, submission.** No convex.site URL (blocked on `npx convex login`, user action), no
   public GitHub repo (no remote configured), no demo video, no screenshots.
3. **KZ-4, integrity.** `interval-submission.md` claims OpenAI, Firecrawl and AgentMail
   integrations, plus Convex auth and crons, none of which exist. Must be rewritten to match the
   build before it is pasted anywhere.

## For Next Skill

- Do not re-run intel, forge or critique. The idea is fixed and the code is written; those skills
  would consume the hours the three missing artifacts need.
- If a partner key arrives, wire OpenAI first, then re-run verify preflight to clear KZ-5 and KZ-4.
- Re-run the Facet 1 five-run test **in a browser against the deployed URL**. The 5/5 recorded
  here was the backend flow driven through the Convex CLI, not the judge-facing path.

## Downstream Items

| ID | Item | Owner | Priority | Status |
|----|------|-------|----------|--------|
| DS-1 | One real partner integration (OpenAI preferred) | build | P1 | open |
| DS-2 | Deploy to convex.site | deploy | P1 | open |
| DS-3 | Create public GitHub repo and push | deploy | P1 | open |
| DS-4 | Rewrite submission Description to match the build | submission | P1 | open |
| DS-5 | Demo video under 3 minutes | demo | P1 | open |
| DS-6 | Re-run 5-run test in a browser on the live URL | verify_preflight | P1 | open |
| DS-7 | README rewrite (still Vite boilerplate) | package | P2 | open |
| DS-8 | Convex auth (named judging sub-criterion) | build | P2 | open |
| DS-9 | submission/ directory with staged assets | package | P2 | open |

## hackathon-verify (preflight) — 2026-09-22

Entry: no PULSE, no conductor state, no upstream skill outputs, no brief. Ran degraded on
substitutes (`interval-build-plan.md` for the PRD, live rules fetch for the brief) and disclosed
every degradation in VERIFY-REPORT.md.

Exit: **BLOCKED**, WINNER-READINESS 47/100 raw, 3 kill-zones triggered (KZ-2, KZ-4, KZ-5),
EMERGENCY escalation. Facets: 15/5/5/11/6/3/2/0. P0 coverage 4/10.

Mid-run change capture: none, verify is read-only apart from its own artifacts.
