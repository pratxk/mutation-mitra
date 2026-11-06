# Mutation Mitra — Architecture

## 1. Principles

1. **The officer decides.** AI only produces suggestions. No code path lets AI change an application's status.
2. **Works without AI.** Every AI feature has a deterministic fallback (rules or templates).
3. **Field-first.** Mobile-first, Hindi-first, one task per screen, low bandwidth, drafts survive a bad network.
4. **Auditable.** History is append-only; every suggestion and every human response to it is recorded.
5. **Small.** One service, one database, one deploy target.

## 2. System context

```
 Lekhpal / Kanungo / Tehsildar (phone or desktop browser)
                 │  HTTPS
                 ▼
        ┌─────────────────────┐
        │  Next.js app (Vercel)│
        │  - UI (Hindi/English)│
        │  - Server actions /  │
        │    API routes        │
        └───┬─────────────┬────┘
            │             │
            ▼             ▼
   ┌──────────────┐  ┌─────────────────┐
   │ Supabase     │  │ LLM API         │
   │ Postgres+Auth│  │ (server-side    │
   │ + Storage    │  │  calls only)    │
   └──────────────┘  └─────────────────┘
```

The browser never calls the LLM or uses the service key directly. All AI calls go through server routes that validate the user's role and the application's current step.

## 3. Components

| Component | Responsibility |
|---|---|
| **UI layer** | Dashboard, case detail, 4 step screens, timeline, language toggle |
| **Workflow service** | State machine, role checks, transition validation, event writing |
| **Rules engine** | Deterministic checks: required documents, survey/गाटा match, area difference, name similarity, SLA age |
| **AI service** | Prompt building, LLM call, JSON schema validation, timeout, fallback, suggestion logging |
| **Priority service** | Computes priority score for the dashboard |
| **Data layer** | Supabase Postgres (RLS on), Supabase Auth, Storage for sample document files |
| **Offline draft store** | Browser IndexedDB/localStorage for unsent field notes |
| **i18n** | `hi.json` and `en.json`, Hindi default |

## 4. Roles and permissions

| Action | Lekhpal | Kanungo | Tehsildar |
|---|---|---|---|
| View assigned/stage cases | own tehsil | own tehsil | own tehsil |
| Complete Step 1, 2 | ✔ | | |
| Complete Step 3 (recommend) | | ✔ | |
| Decide Step 4 | | | ✔ |
| Return to previous step | Step 2 → Step 1 only (no reason needed) | ✔ (reason required) | ✔ (reason required) |
| Request AI at a step | step owner only | step owner only | step owner only |

Enforced twice: in the workflow service (role + current step) and in Postgres Row Level Security (tehsil scoping, read access).

## 5. Workflow state model

```
SUBMITTED
   │ (auto-assign to lekhpal)
   ▼
STEP1_INTAKE ──complete──► STEP2_FIELD ──complete──► STEP3_REVIEW ──recommend──► STEP4_DECISION
     ▲                          ▲   │                      │                          │
     │                          │   └──── return ◄─────────┤                          ├── approve → APPROVED
     └────────── return ◄───────┴────────────────── return ◄────────────────────────┤── reject  → REJECTED
                                                                                      └── return  → previous step
```

- `stage` = which step the case is on. `outcome` = null | APPROVED | REJECTED (terminal).
- A return sets `stage` to the previous step, increments `return_count`, and requires a reason.
- Terminal cases are read-only.

## 6. Key data flows

### 6.1 Intake check (Step 1)
1. Lekhpal opens the case; documents and the existing record are loaded.
2. Rules engine runs instantly: missing documents, गाटा/खसरा mismatch, area difference above tolerance, name similarity.
3. Lekhpal taps "AI जाँच". Server builds a prompt from deed text and existing record, calls the LLM, validates the JSON, and merges with rule results.
4. UI shows each extracted field next to its source snippet, and a list of flags. Lekhpal confirms or corrects, then completes the step.
5. Event + suggestion outcome saved.

### 6.2 Field verification (Step 2)
1. Lekhpal records voice (browser speech recognition, hi-IN) or types.
2. Text autosaves locally; syncs when online.
3. AI structures the text into: possession, boundaries, structures on plot, objections, persons met, conclusion.
4. Lekhpal edits and saves; step completes.

### 6.3 Review (Step 3)
1. Server assembles case facts, Step 1 results, Step 2 report.
2. AI returns a short Hindi summary and risk flags with severity.
3. Kanungo recommends approve/reject/return with a note.

### 6.4 Decision (Step 4)
1. Tehsildar sees summary, flags, Kanungo's recommendation.
2. AI drafts the order (approve/reject) or return reason from templates plus case facts.
3. Tehsildar edits text and presses the decision button; a confirmation dialog shows the final text.
4. Status changes; event recorded with the final text and the AI-vs-final diff flag.

## 7. AI layer design

- **Provider-agnostic wrapper** `llm.complete({system, user, schema})`; swap providers by env var.
- **Structured output only:** each feature has a JSON schema; invalid output is rejected and fallback used.
- **Grounding:** every extracted field returns `source_quote` from the input; UI highlights it; if the quote is not found in the input, the field is marked "unverified".
- **Confidence and uncertainty:** model returns `confidence` per field; low confidence shown as "जाँचें".
- **Timeouts and retries:** 15 s timeout, one retry, then fallback.
- **No autonomy:** AI output stored in `ai_suggestions` with `status = shown`; a human action updates it to `accepted | edited | ignored`.
- **Privacy:** only synthetic data; ID numbers masked before prompting; no data used for training assumptions in README.

| Step | AI task | Fallback |
|---|---|---|
| 1 | Extract fields from deed text; compare with record | Rules-only flags; manual field entry |
| 2 | Structure voice/typed note | Plain note with section headings |
| 3 | Summary + risk flags | Template summary built from fields + rule flags |
| 4 | Draft order/return reason | Static Hindi templates with placeholders filled |

## 8. Priority scoring

```
priority = 100 * (days_in_queue / sla_days)
         + 15 * high_severity_flags
         +  5 * return_count
         + 10 if objection_recorded
```
Dashboard buckets: **अति आवश्यक** (≥ 100 or SLA passed), **जल्द** (60–99), **सामान्य** (<60). Sorted descending within bucket. SLA days configurable per case type.

## 9. Security and audit

- Supabase Auth (email + password for demo users); session cookies via server client.
- RLS: users see only their tehsil's rows; writes only through server routes using the service role after role checks.
- `application_events` is insert-only (no update/delete policy).
- Secrets only in environment variables; `.env.example` committed.
- Rate limit on AI routes per user.

## 10. Field-worker UX architecture

- Mobile-first, single-column, minimum 48 px tap targets, high contrast.
- Hindi default with simple words; icons plus text; English toggle in header.
- Stepper at top always shows "चरण 2 / 4" and what is pending.
- Forms save as you type; clear "सहेजा गया" indicator.
- Pages are server-rendered and light; no heavy client libraries; works on slow 3G.
- Voice input as an optional button, never required.

## 11. Deployment

- **Vercel** for the Next.js app; **Supabase** free tier for DB/Auth/Storage.
- Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_PROVIDER`.
- Seed script run once against production for demo data; admin "reset demo" button optional.

## 12. Key trade-offs

| Decision | Chosen | Why | Cost |
|---|---|---|---|
| Monolith vs services | Single Next.js app | Fast to finish, one deploy | Less separation (acceptable at this scale) |
| Rules before AI | Yes | Reliable, cheap, explainable | More code than "just ask the LLM" |
| Voice via browser API | Web Speech API | No extra service, free | Browser support varies; typing fallback |
| Offline | Draft notes only | Covers the real field pain | Not a full offline-first app |
| Data | Synthetic | No privacy risk | Less realistic messiness; mitigated by crafted edge cases |
