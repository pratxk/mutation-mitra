# Mutation Mitra (म्यूटेशन मित्र) — Project Plan

A Hindi-first workflow tool for field and tehsil-level revenue officers to process **दाखिल-खारिज (land record mutation)** applications: sale (बैनामा) and inheritance (वरासत) cases.

> Assumption: Uttar Pradesh. Roles and terms (लेखपाल, राजस्व निरीक्षक/कानूनगो, तहसीलदार, खतौनी, खसरा, गाटा संख्या) follow UP usage. The app uses a translation file and a configurable role/step config, so another Hindi-speaking state (MP, Rajasthan, Bihar) is a config change. **Verify exact roles, SLA days and document lists with a real officer or the state's revenue code before finalising the README.**

---

## 1. Problem

When land is sold or inherited, the new owner's name must be entered in the revenue record (खतौनी). Today:

- Applications travel as paper files or through slow portals, and sit waiting between desks.
- The लेखपाल has to check documents by eye, visit the plot, and write notes by hand, often late and in inconsistent formats.
- Files get returned for missing or mismatched details (name spelling, area, गाटा संख्या) only after days in the queue.
- Officers rewrite the same order and return-reason text again and again.
- Citizens cannot tell where their file is; officers cannot tell which file is most urgent.

Who it affects: citizens (delay, repeated visits), लेखपाल and कानूनगो (workload, rework), तहसीलदार (no clear summary, backlog, deadline breaches).

## 2. Goal and non-goals

**Goal:** one clean end-to-end flow where a worker can see what needs attention first, move a case through four steps, get honest AI help at each step, make the final decision themselves, and see the full history.

**Non-goals (explicitly out of scope):** real citizen data, integration with live Bhulekh or e-Dakhil systems, payments, citizen-facing portal, real Aadhaar handling, automated decisions of any kind.

## 3. Users and demo accounts

| Role | Hindi | Does |
|---|---|---|
| Lekhpal | लेखपाल | Intake check, field verification |
| Kanungo | राजस्व निरीक्षक | Review and recommend |
| Tehsildar | तहसीलदार | Final decision |
| Admin (optional) | — | Reset demo data |

Credentials for evaluators go in the README (demo only).

## 4. Workflow (4 steps)

1. **दस्तावेज़ जाँच (Intake check)** — Lekhpal. AI extracts fields from the deed and compares with the existing खतौनी record; lists missing and mismatched items.
2. **मौक़ा निरीक्षण (Field verification)** — Lekhpal. Voice or typed note, GPS/time optional, objections recorded. AI turns the voice note into a structured report.
3. **समीक्षा (Review)** — Kanungo. AI one-screen summary with risk flags; Kanungo recommends.
4. **निर्णय (Decision)** — Tehsildar. Approve, Reject or Return. AI drafts the order or reason in Hindi; officer edits and presses the button.

Return rules: the Kanungo (Step 3) and the Tehsildar (Step 4) can return a case with a written reason. A return always goes to the **previous step**, never back to the beginning: Kanungo returns to Step 2 (Lekhpal), Tehsildar returns to Step 3 (Kanungo). The Lekhpal can also step back from Step 2 to Step 1 on their own, with no reason needed.

## 5. Scope tiers

**Must have (MVP):** login with 3 roles, dashboard with priority sorting, 4-step flow, Approve/Reject/Return, append-only history, all 4 AI assists, Hindi UI, mobile-first layout, seeded data, deploy, README.

**Should have:** English toggle, voice input (Web Speech API, hi-IN), offline draft save, overdue highlighting, AI acceptance tracking shown on the timeline.

**Could have (cut first):** PDF export of the order, GPS capture, simple impact page showing the metrics, short video walkthrough.

## 6. Timeline (about 3 days)

### Day 1 — Foundation
- [ ] Repo, Next.js + TypeScript, Tailwind, Supabase project, Vercel link
- [ ] DB schema + migrations + seed script (25 synthetic cases across all stages)
- [ ] Auth with 3 demo users and role-based routing
- [ ] Hindi/English i18n setup, Devanagari font, base layout (mobile-first)
- [ ] Dashboard: list, priority score, overdue badge, filters
- [ ] Application detail page shell with stepper and timeline

**Done when:** a Lekhpal can log in and see a priority-sorted list; opening a case shows its history.

### Day 2 — Workflow and AI
- [ ] State machine + transition API with role checks; every transition writes an event
- [ ] Step 1 screen: documents, rule-based checks, AI extraction and mismatch list
- [ ] Step 2 screen: voice/typed note, AI structuring, edit and save
- [ ] Step 3 screen: AI summary and risk flags, Kanungo recommendation
- [ ] Step 4 screen: AI draft order, edit, Approve/Reject/Return with confirmation
- [ ] `ai_suggestions` logging: accepted / edited / ignored
- [ ] Rule-based fallback when the AI call fails or times out

**Done when:** one case can be taken from submitted to approved by switching between the three demo users, and one case can be returned and resumed.

### Day 3 — Polish and ship
- [ ] Field-worker usability pass on a phone (large tap targets, one task per screen, low data)
- [ ] Offline draft save for field notes
- [ ] Empty/error/loading states, Hindi copy review
- [ ] Small eval run on AI extraction (see techspec §9) and record the numbers
- [ ] Deploy, smoke test with the demo logins on production URL
- [ ] README (all required sections), architecture diagram, screenshots
- [ ] Optional: 2–3 minute video

## 7. Success measures (for README)

| Metric | Why | Baseline vs target (pilot) |
|---|---|---|
| Median days per application | Core delay | Measure 4 weeks before vs 4 weeks after at one tehsil |
| % returned for missing/mismatched documents | Intake check should reduce avoidable returns | Target a visible drop |
| Minutes per step (Lekhpal, Kanungo) | Rewriting and summarising time | Event timestamps |
| Share of AI drafts accepted or lightly edited | Is AI actually useful | Track from `ai_suggestions` |
| Overdue cases beyond SLA | Priority view effect | Dashboard count |

Why it should work: most avoidable delay is rework (returns, rewriting), and each AI assist targets exactly one of those. Because the officer always decides, risk to correctness stays low and adoption friction stays small.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI extraction wrong on messy deeds | Rule-based checks run first; show source text next to each extracted field; officer confirms |
| LLM slow or down | Timeout + fallback to rules and templates; app fully usable without AI |
| Hindi speech recognition poor or unsupported on some browsers | Typing always available; voice is progressive enhancement |
| Scope creep | Cut-list in §5; no new features after Day 2 evening |
| Real process detail wrong | State assumptions in README; keep step/role config editable |
| Privacy | Synthetic data only; mask ID numbers; never send real PII to the LLM |

## 9. Definition of done / submission checklist

- [ ] GitHub repo accessible, clean commit history
- [ ] Live URL works on mobile, demo credentials in the README
- [ ] README covers: problem and who it affects; what it does and the steps; where AI helps and why; impact measurement; main technical decisions; run locally
- [ ] End-to-end flow demonstrated with approve, reject and return paths
- [ ] `.env.example` present; no secrets committed
- [ ] Optional video link
- [ ] Reply email with repo link, live link, credentials

## 10. Demo script (3 minutes)

1. Lekhpal logs in on a phone: dashboard shows overdue case on top.
2. Open case: AI flags a name spelling mismatch and area difference in the intake check.
3. Voice note in Hindi becomes a structured field report.
4. Kanungo sees the summary and risk flags, recommends approval.
5. Tehsildar reads the AI-drafted order, edits one line, approves.
6. Timeline shows each action, who did it, and whether AI text was accepted, edited or ignored.
7. Show a returned case with a drafted return reason.
