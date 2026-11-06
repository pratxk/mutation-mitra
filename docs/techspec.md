# Mutation Mitra — Technical Specification

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS; font: Noto Sans Devanagari |
| i18n | `next-intl`, locales `hi` (default), `en` |
| DB/Auth/Storage | Supabase (Postgres, Auth, Storage) |
| Validation | Zod (inputs, AI outputs) |
| AI | LLM API behind `lib/ai/llm.ts` (provider via env) |
| Voice | Web Speech API (`hi-IN`), progressive enhancement |
| Offline drafts | `idb-keyval` (IndexedDB) |
| Tests | Vitest (unit), Playwright (one e2e happy path) |
| Deploy | Vercel + Supabase |

## 2. Repository layout

```
/
├─ README.md
├─ plan.md  architecture.md  techspec.md
├─ .env.example
├─ supabase/
│  ├─ migrations/0001_init.sql
│  └─ seed/seed.ts
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ page.tsx                      # dashboard
│  │  │  └─ cases/[id]/page.tsx           # case detail + step screens
│  │  └─ api/
│  │     ├─ cases/[id]/transition/route.ts
│  │     └─ ai/{extract,structure-note,summarize,draft-order}/route.ts
│  ├─ components/ (Stepper, CaseCard, Timeline, FlagList, VoiceButton, AiPanel, DecisionBar)
│  ├─ lib/
│  │  ├─ workflow/{states.ts,transition.ts,permissions.ts}
│  │  ├─ rules/{documents.ts,match.ts,area.ts,names.ts}
│  │  ├─ ai/{llm.ts,prompts.ts,schemas.ts,fallbacks.ts,log.ts}
│  │  ├─ priority.ts
│  │  └─ supabase/{server.ts,client.ts}
│  └─ messages/{hi.json,en.json}
└─ tests/
```

## 3. Data model (Postgres)

```sql
create type role_t as enum ('lekhpal','kanungo','tehsildar','admin');
create type case_type_t as enum ('sale','inheritance');
create type stage_t as enum ('step1_intake','step2_field','step3_review','step4_decision');
create type outcome_t as enum ('approved','rejected');

create table profiles (
  id uuid primary key references auth.users,
  name text not null, name_hi text,
  role role_t not null,
  tehsil text not null
);

-- Synthetic existing revenue record (खतौनी) used for comparison
create table land_records (
  id uuid primary key default gen_random_uuid(),
  village text not null, khata_no text not null, gata_no text not null,
  area_sqm numeric not null,
  owner_name text not null,           -- as written in record
  tehsil text not null
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique not null,        -- e.g. DK-2026-00123
  case_type case_type_t not null,
  tehsil text not null, village text not null,
  applicant_name text not null,       -- new owner
  transferor_name text not null,      -- seller / deceased
  land_record_id uuid references land_records,
  claimed_gata_no text, claimed_area_sqm numeric,
  stage stage_t not null default 'step1_intake',
  outcome outcome_t,
  return_count int not null default 0,
  submitted_at timestamptz not null default now(),
  sla_days int not null default 45,
  assigned_to uuid references profiles,
  flags_summary jsonb default '[]'::jsonb,
  decided_at timestamptz
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  doc_type text not null,             -- 'sale_deed','khatauni_copy','id_proof','death_cert','vanshavali','affidavit'
  file_path text,                     -- Supabase Storage (sample files)
  extracted_text text                 -- pre-seeded OCR/text for synthetic docs
);

create table step_data (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  stage stage_t not null,
  data jsonb not null,                -- confirmed fields, field report, recommendation, final order text
  saved_by uuid references profiles,
  saved_at timestamptz default now(),
  unique (application_id, stage)
);

create table ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications on delete cascade,
  stage stage_t not null,
  kind text not null,                 -- 'extract','structure_note','summary','draft_order'
  output jsonb not null,
  used_fallback boolean default false,
  latency_ms int,
  status text not null default 'shown',  -- shown|accepted|edited|ignored
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Append-only history
create table application_events (
  id bigserial primary key,
  application_id uuid references applications on delete cascade,
  at timestamptz default now(),
  actor uuid references profiles,
  actor_role role_t,
  action text not null,               -- 'submitted','step_completed','ai_suggested','ai_accepted','ai_edited','ai_ignored','returned','approved','rejected','note'
  from_stage stage_t, to_stage stage_t,
  reason text,
  meta jsonb default '{}'::jsonb
);
```

**RLS:** `profiles`, `applications`, `documents`, `step_data`, `ai_suggestions`, `application_events` are readable where `tehsil` equals the user's tehsil. No update/delete policy on `application_events`. All writes go through server routes using the service role after permission checks.

## 4. Workflow engine

`lib/workflow/transition.ts`

```ts
type Action = 'complete' | 'return' | 'approve' | 'reject';

const ORDER = ['step1_intake','step2_field','step3_review','step4_decision'] as const;
const STEP_OWNER = {
  step1_intake:'lekhpal', step2_field:'lekhpal',
  step3_review:'kanungo', step4_decision:'tehsildar'
};

function canAct(role, stage, action) {
  if (action === 'complete') return STEP_OWNER[stage] === role && stage !== 'step4_decision';
  if (action === 'return')   return (role==='kanungo' && stage==='step3_review')
                                 || (role==='tehsildar' && stage==='step4_decision');
  if (action==='approve'||action==='reject') return role==='tehsildar' && stage==='step4_decision';
  return false;
}
```

Rules enforced by `transition()` in one DB transaction:
1. Case not terminal.
2. `canAct(role, stage, action)`.
3. `complete` requires validated `step_data` for the stage (Zod).
4. `return` requires a non-empty reason; sets stage to previous; `return_count += 1`. Lekhpal steps return Step 2 → Step 1 only by the Lekhpal's own action ("पिछले चरण पर जाएँ"), no reason needed.
5. `approve/reject` set `outcome`, `decided_at`; reject requires a reason; approve/reject require final order text.
6. Insert event row(s); resolve any open AI suggestion for this stage as accepted/edited/ignored by comparing final text with the suggestion.

## 5. Rules engine (deterministic)

| Rule | Logic | Output flag |
|---|---|---|
| Required documents | sale: deed, khatauni copy, ID; inheritance: death cert, vanshavali, affidavit, ID | `missing_doc` (high) |
| Gata match | normalise digits/Devanagari numerals; compare claimed vs record | `gata_mismatch` (high) |
| Area difference | `abs(a-b)/b > 2%` medium, `> 10%` high | `area_diff` |
| Name variant | normalised Devanagari string + token-set similarity; < 0.85 = flag; transliteration table for common variants (e.g. मोहम्मद/मुहम्मद) | `name_variant` (medium) |
| Transferor is recorded owner | transferor name vs record owner | `owner_mismatch` (high) |
| SLA age | days since submission vs `sla_days` | `sla_overdue` |

Rules run on every load of Step 1/3; results are pure functions and unit tested.

## 6. AI features: contracts and prompts

All endpoints: `POST /api/ai/<kind>` body `{ applicationId }`. Server loads data itself (never trusts client-supplied case facts), checks role and stage, returns `{ suggestionId, output, usedFallback }`.

### 6.1 `extract` (Step 1)
Input: deed/document `extracted_text`, existing `land_record`.
Output schema:
```ts
{
  fields: {
    seller_name, buyer_name, gata_no, khata_no, village, area_sqm, sale_date
  } : Record<string, { value: string|null, source_quote: string|null, confidence: number }>,
  discrepancies: { field: string, deed_value: string, record_value: string, note_hi: string }[],
  missing_items_hi: string[]
}
```
System prompt (gist): *You assist a revenue officer. Extract only what is written in the document. Return `null` if not present. For every value provide the exact quote from the text. Do not guess. Respond in JSON matching the schema; notes in simple Hindi.*
Post-processing: drop any field whose `source_quote` is not a substring of the input; mark as `unverified`.

### 6.2 `structure-note` (Step 2)
Input: raw note text. Output:
```ts
{ possession: string, boundaries: string, structures: string, objections: string[],
  persons_met: string[], conclusion: string, unclear_points_hi: string[] }
```
Prompt: *Reorganise the officer's note. Do not add facts. If something is missing leave it empty and list it in `unclear_points_hi`.*

### 6.3 `summarize` (Step 3)
Input: case facts, confirmed Step 1 data, rule flags, Step 2 report. Output:
```ts
{ summary_hi: string /* max 120 words */,
  risks: { title_hi: string, severity: 'high'|'medium'|'low', evidence: string }[],
  suggested_next_hi: string }
```
Prompt rule: every risk must cite evidence from the provided data.

### 6.4 `draft-order` (Step 4)
Input: case facts, summary, Kanungo's recommendation, chosen action (approve | reject | return). Output: `{ text_hi: string }` built on top of fixed order templates (heading, reference, facts, finding, order line). The model fills facts and reasoning; legal boilerplate comes from templates so it cannot be altered by the model.

### Fallbacks (`lib/ai/fallbacks.ts`)
- extract → regex pulls for gata/area plus manual entry; rules flags only
- structure-note → sectioned empty form prefilled with raw text
- summarize → template string from fields + flags
- draft-order → Hindi template with placeholders filled

### Logging
Each call inserts into `ai_suggestions` and an `ai_suggested` event. UI sends resolution (`accepted` if text unchanged, `edited` if changed, `ignored` if discarded or fully replaced).

## 7. API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/cases` | GET | Dashboard list with priority and bucket, filters: stage, bucket, case_type |
| `/api/cases/[id]` | GET | Case, documents, step data, flags, events |
| `/api/cases/[id]/save-step` | POST | Save draft step data |
| `/api/cases/[id]/transition` | POST | `{action, reason?, finalText?}` |
| `/api/ai/{extract,structure-note,summarize,draft-order}` | POST | AI suggestions |
| `/api/ai/resolve` | POST | `{suggestionId, status}` |

Responses use a common `{ ok, data?, error? }` shape; errors have Hindi-friendly `message_hi`.

## 8. UI specification

### 8.1 Dashboard (`/`)
- Header: name, role badge, language toggle, logout.
- Summary tiles: अति आवश्यक / जल्द / सामान्य counts (tappable filters).
- List of case cards: ref no, applicant, village, case type, step chip, "X दिन / 45", red badge for overdue, flag icons, return count.
- Default sort: priority descending. Lekhpal sees only cases at Steps 1–2; Kanungo Step 3; Tehsildar Step 4; an "सभी" tab shows all in tehsil read-only.

### 8.2 Case detail (`/cases/[id]`)
- Sticky stepper "चरण N / 4" with names and completed ticks.
- Main panel changes by step (below). Secondary tabs: दस्तावेज़ | इतिहास.
- Bottom action bar (sticky): primary action, secondary "वापस भेजें" where allowed.

### 8.3 Step screens
1. **Intake:** document checklist with ✔/✖; two-column table (Deed vs Record) with highlight on mismatches; "AI जाँच" button; each AI field shows source quote on tap; confirm checkbox "मैंने जाँच कर ली है".
2. **Field:** large mic button + text area; autosave indicator; after "व्यवस्थित करें" structured form appears, editable; objection toggle.
3. **Review:** summary card, risk list sorted by severity, link to Step 1/2 data, recommendation radio (स्वीकृत करें / अस्वीकृत करें / वापस भेजें) with note.
4. **Decision:** summary + Kanungo's recommendation, "आदेश का मसौदा" editable text area, three buttons: **स्वीकृत करें / अस्वीकृत करें / वापस भेजें**, each opening a confirmation dialog that shows the final text.

### 8.4 Timeline
Vertical list: time, actor (name + role), action in Hindi, reason/text, and AI chip (`AI सुझाव स्वीकार / संपादित / अनदेखा`). Read-only, newest first.

### 8.5 Accessibility and field constraints
Min tap target 48 px, font ≥ 16 px, contrast AA, no hover-only interactions, no layout shift on language switch, page weight under ~200 KB JS on first load, works at 360 px width.

## 9. Evaluation of AI (small, honest)

- Build 20 synthetic deeds/records with known ground truth, including 8 with seeded problems (name variant, area difference, wrong gata, missing seller).
- Metrics: field-level extraction accuracy; discrepancy recall (found / seeded); false-flag rate; fallback activation rate.
- Run `npm run eval` and paste the table into the README. Report real numbers, including failures.

## 10. Seed data

- 3 demo users (one per role) + 1 admin, same tehsil; passwords in README.
- 25 applications distributed: 8 at Step 1, 5 at Step 2, 5 at Step 3, 4 at Step 4, 2 approved, 1 rejected; 3 overdue; 2 with return history.
- 8 hand-crafted edge cases (see §9). All names, villages and numbers fictional.

## 11. Testing

| Type | What |
|---|---|
| Unit | Rules engine (numerals, names, area), priority score, permissions matrix, transition guards |
| Contract | Zod parsing of AI outputs; fallback triggered on invalid JSON/timeout |
| E2E (Playwright) | Login as 3 roles → take one case from Step 1 to Approved; one return path |
| Manual | Phone pass on a real Android device with throttled network; Hindi copy review |

## 12. Environment and running locally

```bash
git clone <repo> && cd mutation-mitra
cp .env.example .env.local        # fill Supabase + LLM keys
npm install
npx supabase db push              # or run supabase/migrations/0001_init.sql
npm run seed                      # demo users + 25 cases
npm run dev                       # http://localhost:3000
```

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_PROVIDER=anthropic
LLM_API_KEY=
LLM_MODEL=
AI_TIMEOUT_MS=15000
```

## 13. README outline (maps to the submission asks)

1. Problem and who it affects
2. What the app does and the four steps (with screenshots)
3. Where AI helps and why (table: step, task, fallback, why it is safe)
4. Impact measurement and why it should work
5. Technical decisions (rules before AI, structured outputs, append-only history, RLS, mobile-first, offline drafts)
6. AI evaluation results
7. Run locally
8. Demo credentials and assumptions/limitations (UP process assumptions, synthetic data)

## 14. Open items to confirm

- Exact SLA days and mandatory document list for दाखिल-खारिज in the target district (45 days is a placeholder).
- Whether Naib Tahsildar rather than Tahsildar decides uncontested cases locally; role names are configurable in `states.ts`.
- Which LLM provider and key will be available for the live deployment.
