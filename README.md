# Mutation Mitra (म्यूटेशन मित्र)

> A Hindi-first workflow tool that helps field and tehsil-level revenue officers process **दाखिल-खारिज** (land record mutation) applications faster, with AI that suggests and humans that decide.

**For reviewers:** open [`docs/explainer.html`](docs/explainer.html) in a browser for a visual walkthrough (flow, architecture, AI request lifecycle, data model). This README is the written version.

| | |
|---|---|
| Stack | Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS) · Zod · next-intl |
| AI | Google Gemini behind a provider-agnostic wrapper (Anthropic also supported) |
| Tests | 15 unit/contract tests (Vitest) · 2 end-to-end flows (Playwright) · AI eval script |
| Design docs | [`docs/plan.md`](docs/plan.md) · [`docs/architecture.md`](docs/architecture.md) · [`docs/techspec.md`](docs/techspec.md) |

---

## Table of contents

1. [The problem](#1-the-problem)
2. [What the app does](#2-what-the-app-does)
3. [Roles and permissions](#3-roles-and-permissions)
4. [Where AI helps, and why it is safe](#4-where-ai-helps-and-why-it-is-safe)
5. [Architecture](#5-architecture)
6. [How a request flows](#6-how-a-request-flows)
7. [Data model](#7-data-model)
8. [Priority scoring](#8-priority-scoring)
9. [Security and audit](#9-security-and-audit)
10. [Field-worker UX](#10-field-worker-ux)
11. [Run it locally](#11-run-it-locally)
12. [Environment variables](#12-environment-variables)
13. [Testing and AI evaluation](#13-testing-and-ai-evaluation)
14. [Project structure](#14-project-structure)
15. [Key technical decisions](#15-key-technical-decisions)
16. [Impact measurement](#16-impact-measurement)
17. [Assumptions and limitations](#17-assumptions-and-limitations)
18. [Demo accounts](#18-demo-accounts)

---

## 1. The problem

When land is sold or inherited, the new owner's name has to be entered in the revenue record (खतौनी). Today:

- Applications move as paper files or through slow portals and wait between desks.
- The लेखपाल (Lekhpal) checks documents by eye, visits the plot and writes notes by hand, often late and in inconsistent formats.
- Files come back for missing or mismatched details (name spelling, area, गाटा संख्या) only after days in the queue.
- Officers rewrite the same orders and return reasons again and again.
- Nobody can see which file is most urgent.

It affects citizens (delay, repeat visits), Lekhpals and Kanungos (workload, rework) and Tehsildars (no clear summary, backlog, missed deadlines).

## 2. What the app does

Login with one of three roles, see a priority-sorted dashboard, and move each case through four steps:

```
Application ─► 1 Document check ─► 2 Field inspection ─► 3 Review ─► 4 Decision ─► Approved / Rejected
                  Lekhpal             Lekhpal             Kanungo      Tehsildar
```

| Step | Hindi | Owner | What happens |
|---|---|---|---|
| 1 | दस्तावेज़ जाँच | Lekhpal | Checklist of required papers; deed-vs-record table; rule-based flags; **AI extracts fields from the deed** with the source quote beside each. Lekhpal corrects, ticks "I verified", completes. |
| 2 | मौक़ा निरीक्षण | Lekhpal | Voice (hi-IN) or typed field note with offline-safe autosave. **AI structures it** into possession, boundaries, structures, objections, persons met, conclusion. |
| 3 | समीक्षा | Kanungo | **AI gives a short Hindi summary and evidence-cited risks.** Kanungo recommends approve / reject / return with a note. |
| 4 | निर्णय | Tehsildar | **AI drafts the order.** Tehsildar edits it, presses a decision button and confirms in a dialog that shows the final text. |

**Returns** always go to the previous step, with a written reason: Kanungo returns to Step 2, Tehsildar to Step 3. Lekhpal can also step back from Step 2 to Step 1 without a reason. A decided case is read-only.

**Timeline:** every action is stored in an append-only history, with a chip showing whether each AI suggestion was accepted, edited or ignored.

## 3. Roles and permissions

| Action | Lekhpal | Kanungo | Tehsildar |
|---|:-:|:-:|:-:|
| See cases in own tehsil | ✔ | ✔ | ✔ |
| Complete Step 1 and 2 | ✔ | | |
| Complete Step 3 (recommend) | | ✔ | |
| Decide Step 4 | | | ✔ |
| Return a case | step back 2→1 (no reason) | ✔ (reason required) | ✔ (reason required) |
| Request AI at a step | step owner only | step owner only | step owner only |

Enforced in the workflow service (role + current step) and in Postgres Row Level Security (tehsil scoping on reads). Role names live in `src/lib/workflow/states.ts`, so another state or district is a config change.

## 4. Where AI helps, and why it is safe

| Step | AI task | Fallback when AI fails |
|---|---|---|
| 1 | Extract fields from deed text, compare with the record | Regex pulls plus rule flags, manual entry |
| 2 | Structure the field note | Raw note placed in the possession box |
| 3 | Summary plus risks that cite evidence | Template built from the rule flags |
| 4 | Draft order or return reason | Hindi template with the facts filled in |

Safeguards:

- **AI never changes a case's status.** Only a human action calls the transition API.
- **Rules run first** and need no network. AI only adds on top.
- **Structured output only:** every response is validated with Zod; invalid output triggers the fallback.
- **Grounding:** every extracted field returns a `source_quote`. If the quote is not in the document text, the field is marked "unverified".
- **Timeouts and retries:** 15 s per try, retry on 429/5xx with backoff, then fallback.
- **Privacy:** only synthetic data; ID-like numbers (10+ digits) are masked before prompting.
- **Auditable:** each suggestion is stored in `ai_suggestions`, then resolved as `accepted`, `edited` or `ignored`.
- **Fully usable with no API key.**

## 5. Architecture

One Next.js service, one database, one deploy target.

```
 Lekhpal / Kanungo / Tehsildar (phone or desktop browser)
                 │ HTTPS
                 ▼
        ┌──────────────────────────┐
        │ Next.js app              │
        │  UI (Hindi / English)    │
        │  Route handlers (API)    │
        │  Workflow · Rules · AI   │
        └───────┬───────────┬──────┘
                ▼           ▼
        ┌─────────────┐  ┌──────────────┐
        │  Supabase   │  │  Gemini API  │
        │  Postgres   │  │ (server-side │
        │  Auth · RLS │  │  calls only) │
        └─────────────┘  └──────────────┘
```

The browser never calls Gemini and never sees the service-role key.

| Component | Where | Job |
|---|---|---|
| UI | `src/app/[locale]`, `src/components` | Dashboard, case page, four step panels, timeline |
| Workflow | `src/lib/workflow` | Permissions and transition planning |
| Rules engine | `src/lib/rules` | Deterministic checks (documents, gata, area, names, SLA) |
| AI service | `src/lib/ai` | Prompts, LLM call, validation, grounding, fallbacks, logging |
| Priority | `src/lib/priority.ts` | Dashboard score and buckets |
| Data | `supabase/migrations` | Schema, RLS, atomic transition function |
| i18n | `src/messages`, `src/i18n` | `hi.json` (default) and `en.json` |

## 6. How a request flows

**Moving a case** (`POST /api/cases/[id]/transition`):

1. Auth and tehsil check, then load the case.
2. `planTransition()` validates the role, the stage, the step data (Zod), and the reason or order text where required.
3. Postgres function `apply_transition` runs in one transaction: lock the row, reject a stale stage (two people clicking at once), update stage or outcome, insert the history event, close open AI suggestions.

**Asking for AI** (`POST /api/ai/[kind]`):

1. Auth, tehsil, role and stage checks, plus a rate limit of 10 calls a minute per user.
2. The server loads the case facts itself and never trusts what the browser sends.
3. Mask ID numbers, build the prompt, call Gemini, validate with Zod, ground the quotes.
4. On any failure, use the fallback.
5. Save to `ai_suggestions` and log an `ai_suggested` event. The UI later reports `accepted`, `edited` or `ignored`.

### API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/cases` | GET | Dashboard list with score and bucket; filters `stage`, `bucket`, `case_type` |
| `/api/cases/[id]` | GET | Case, documents, step data, flags, events, suggestions |
| `/api/cases/[id]/save-step` | POST | Save draft step data (step owner only) |
| `/api/cases/[id]/transition` | POST | `{action, reason?, finalText?}` where action is `complete`, `return`, `approve`, `reject` or `step_back` |
| `/api/ai/{extract,structure-note,summarize,draft-order}` | POST | Request an AI suggestion |
| `/api/ai/resolve` | POST | `{suggestionId, status}` |

Responses use `{ ok, data?, error?, message_hi? }`.

## 7. Data model

Seven tables in Postgres: `profiles`, `land_records` (synthetic existing खतौनी), `applications`, `documents`, `step_data` (one row per case per stage), `ai_suggestions`, `application_events` (append-only history). Full DDL is in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql); the atomic transition function is in [`0002_transition.sql`](supabase/migrations/0002_transition.sql).

## 8. Priority scoring

```
priority = 100 × (days_in_queue / sla_days)
         +  15 × high_severity_flags
         +   5 × return_count
         +  10 if an objection was recorded
```

Buckets: **अति आवश्यक** (score ≥ 100 or past SLA), **जल्द** (60–99), **सामान्य** (below 60). Cases sort by score within the dashboard. SLA is 45 days by default and configurable per case.

## 9. Security and audit

- Supabase Auth with email and password; session cookies refreshed in middleware.
- Row Level Security: users read only their tehsil's rows. Writes go through server routes with the service role, after role checks.
- `application_events` has no update or delete policy, and `update`/`delete` are revoked for client roles.
- Secrets live only in environment variables. `.env.example` is committed; `.env.local` is gitignored.
- AI routes are rate limited per user (in memory, fine for a single instance).

## 10. Field-worker UX

Mobile-first single column, 48 px minimum tap targets, Hindi by default with simple words, English toggle, a stepper showing "चरण N / 4", autosave with a visible "सहेजा गया" status, voice input as an optional button, and about 185 kB first-load JavaScript. Step 2 drafts are kept in IndexedDB so they survive a bad network.

## 11. Run it locally

Requires Node 20+ and Docker.

```bash
git clone https://github.com/pratxk/mutation-mitra.git
cd mutation-mitra
npm install

npx supabase start                # local Postgres + Auth; applies supabase/migrations
npx supabase status               # prints the local URL and keys
cp .env.example .env.local        # paste the local URL and keys; optionally add LLM_API_KEY
npm run seed                      # 4 demo users + 25 synthetic cases
npm run dev                       # http://localhost:3000
```

Without `LLM_API_KEY` every AI feature runs on its rule and template fallback, so the whole flow still works.

### Using a hosted Supabase project instead of local

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to your project's values, apply the two files in `supabase/migrations/` (SQL editor or `supabase db push`), then run `npm run seed`. The seed deletes and recreates rows in `applications` and `land_records`, so use a project where those tables belong to this app.

## 12. Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key; reads are limited by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Never commit or expose |
| `LLM_PROVIDER` | `gemini` (default) or `anthropic` |
| `LLM_API_KEY` | Provider key; empty means fallbacks only |
| `LLM_MODEL` | Default `gemini-3.1-flash-lite` |
| `AI_TIMEOUT_MS` | Per-try timeout, default 15000 |

Free-tier Gemini quota is per model per day. If a model returns 429, change `LLM_MODEL`.

## 13. Testing and AI evaluation

```bash
npm test         # Vitest: rules, priority, permissions, transitions, AI contract (15 tests)
npm run e2e      # Playwright: reseeds the DB, serves on :3100, runs two flows
npm run eval     # AI evaluation over 20 synthetic deeds
npm run typecheck
```

- **Unit/contract:** numeral and name normalisation, area thresholds, priority buckets, permission matrix, transition guards, quote grounding, schema rejection, fallback when no key, ID masking.
- **E2E:** one case from Step 1 to Approved across all three roles; one return path.

### AI evaluation

20 synthetic deeds, 8 with seeded problems (name variant, area difference, wrong gata, wrong owner). Run with `gemini-3.1-flash-lite` on the free tier:

| Metric | Result |
|---|---|
| Field extraction accuracy (gata, area) | 100% (40/40) |
| Discrepancy recall (rules + AI) | 100% (8/8) |
| False-flag rate on clean cases | 0% (0/12) |
| Fallback activation | 15% (3/20) |

Honest caveats: the synthetic deeds are short and clean, so real scanned deeds will score lower. The fallbacks here came from free-tier rate limits (429/503), not bad model output. The regex fallback alone also scores 100% on this easy set, so this eval shows the pipeline works, not that the LLM beats the regex.

## 14. Project structure

```
├─ docs/                    plan.md · architecture.md · techspec.md · explainer.html
├─ supabase/
│  ├─ migrations/           0001_init.sql · 0002_transition.sql
│  └─ seed/seed.ts          demo users + 25 synthetic cases
├─ scripts/eval.ts          AI evaluation
├─ src/
│  ├─ app/[locale]/         login, dashboard, case page
│  ├─ app/api/              cases, save-step, transition, ai/*
│  ├─ components/           Stepper, CaseCard, Step1-4 panels, Timeline, VoiceButton ...
│  ├─ lib/
│  │  ├─ workflow/          states, permissions, transition planning
│  │  ├─ rules/             documents, gata, area, names, flags
│  │  ├─ ai/                llm, prompts, schemas, fallbacks, service, mask
│  │  ├─ priority.ts · case.ts · list.ts · guard.ts · api.ts
│  │  └─ supabase/          server and browser clients
│  ├─ i18n/ · messages/     hi.json, en.json
│  └─ middleware.ts         locale + session refresh + auth redirect
└─ tests/                   unit tests + e2e/
```

## 15. Key technical decisions

| Decision | Why | Cost |
|---|---|---|
| Single Next.js app | One deploy, fast to finish | Less separation, fine at this scale |
| Rules before AI | Reliable, cheap, explainable | More code than "ask the LLM" |
| Structured, validated AI output | Bad output cannot reach the UI | Needs fallbacks |
| Atomic SQL transition | No double-click or stale-stage corruption | Logic split between TS and SQL |
| Append-only events | Trustworthy audit trail | Corrections are new events |
| Web Speech API for voice | Free, no extra service | Browser support varies, typing always works |
| Draft-only offline | Covers the real field pain | Not a full offline-first app |
| Synthetic data | No privacy risk | Less messy than reality |

## 16. Impact measurement

| Metric | Source |
|---|---|
| Median days per application | `applications.submitted_at` to `decided_at`; 4 weeks before vs after at one tehsil |
| % returned for missing or mismatched documents | `application_events` where action is `returned` |
| Minutes per step | Event timestamps per actor |
| Share of AI drafts accepted or lightly edited | `ai_suggestions.status` |
| Overdue cases beyond SLA | Dashboard count |

Most avoidable delay is rework, and each AI assist targets one rework source. Because the officer always decides, correctness risk stays low and adoption friction stays small.

## 17. Assumptions and limitations

- Assumes **Uttar Pradesh** terminology and process. The 45-day SLA and the required-document lists are placeholders; verify with a real officer or the state revenue code.
- All data is synthetic. No real citizen data, no Bhulekh integration, no payments, no automated decisions.
- Voice recognition quality in Hindi depends on the browser; Chrome and Edge are best.
- The AI rate limiter is in memory (single instance).
- Not built: PDF export of orders, GPS capture, admin "reset demo" button, citizen portal.

## 18. Demo accounts

Password for all: `demo1234` (demo only).

| Role | Email |
|---|---|
| Lekhpal | `lekhpal@demo.in` |
| Kanungo | `kanungo@demo.in` |
| Tehsildar | `tehsildar@demo.in` |
| Admin | `admin@demo.in` |

Try case `DK-2026-00105` for a clean flow, or `DK-2026-00100` to `-00104` for seeded problems (name variant, area difference, gata mismatch, missing document, wrong owner). Log in as Lekhpal, finish Steps 1 and 2, then log in as Kanungo and then Tehsildar.
