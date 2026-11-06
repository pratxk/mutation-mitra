// `npm run eval`: 20 synthetic deeds with known ground truth (8 with seeded problems).
// Uses the real LLM when LLM_API_KEY is set, else measures the fallback path. Prints a markdown table.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { complete } from '../src/lib/ai/llm';
import { buildPrompt } from '../src/lib/ai/prompts';
import { fallbackExtract } from '../src/lib/ai/fallbacks';
import { extractSchema } from '../src/lib/ai/schemas';
import { groundExtract } from '../src/lib/ai/service';
import { runRules } from '../src/lib/rules';
import type { CaseBundle } from '../src/lib/case';

type Problem = 'name_variant' | 'area_diff' | 'gata_mismatch' | 'owner_mismatch' | null;
const PROBLEMS: Problem[] = ['name_variant', 'area_diff', 'gata_mismatch', 'owner_mismatch', 'name_variant', 'area_diff', 'gata_mismatch', 'owner_mismatch'];

const cases = Array.from({ length: 20 }, (_, i) => {
  const problem = i < 8 ? PROBLEMS[i] : null;
  const gata = 100 + i * 3, area = 900 + i * 40;
  const seller = ['रामलाल', 'सुरेश कुमार', 'गीता देवी', 'हरिशंकर'][i % 4];
  const buyer = ['अजय सिंह', 'प्रमोद यादव', 'सीमा देवी', 'दीपक वर्मा'][i % 4];
  const deedGata = problem === 'gata_mismatch' ? gata + 1 : gata;
  const deedArea = problem === 'area_diff' ? Math.round(area * 1.15) : area;
  const deedBuyer = problem === 'name_variant' ? buyer.replace(/\s.*/, ' सिन्हा') : buyer;
  const text = `बैनामा: विक्रेता ${seller} ने क्रेता ${deedBuyer} को गाटा संख्या ${deedGata}, रकबा ${deedArea} वर्ग मीटर की भूमि बेची।`;
  return { i, problem, gata, area, seller, buyer, deedGata, deedArea, text };
});

async function main() {
  let fieldOk = 0, fieldTotal = 0, found = 0, seeded = 0, falseFlags = 0, cleanN = 0, fallbacks = 0;
  for (const c of cases) {
    const record = { id: 'r', village: 'v', khata_no: '1', gata_no: String(c.gata), area_sqm: c.area, owner_name: c.problem === 'owner_mismatch' ? 'तुलसीराम' : c.seller };
    const bundle = {
      app: { id: 'a', ref_no: `E-${c.i}`, case_type: 'sale', tehsil: 't', village: 'v', applicant_name: c.buyer, transferor_name: c.seller, land_record_id: 'r', claimed_gata_no: String(c.deedGata), claimed_area_sqm: c.deedArea, stage: 'step1_intake', outcome: null, return_count: 0, submitted_at: new Date().toISOString(), sla_days: 45, decided_at: null },
      docs: [{ id: 'd', doc_type: 'sale_deed', file_path: null, extracted_text: c.text }],
      record, steps: {}, flags: [],
    } as unknown as CaseBundle;
    bundle.flags = runRules({ caseType: 'sale', presentDocs: ['sale_deed', 'khatauni_copy', 'id_proof'], claimedGata: String(c.deedGata), claimedArea: c.deedArea, transferorName: c.seller, applicantName: c.buyer, record, submittedAt: bundle.app.submitted_at, slaDays: 45 });

    let out;
    try { out = groundExtract(await complete({ ...buildPrompt('extract', bundle), schema: extractSchema }), c.text); }
    catch { fallbacks++; out = fallbackExtract(bundle); }

    for (const [k, truth] of [['gata_no', String(c.deedGata)], ['area_sqm', String(c.deedArea)]] as const) {
      fieldTotal++;
      if ((out.fields[k]?.value ?? '').replace(/\D/g, '') === truth) fieldOk++;
    }
    const b = out.fields.buyer_name?.value;
    if (b) bundle.flags = [...bundle.flags, ...runRules({ caseType: 'sale', presentDocs: ['sale_deed', 'khatauni_copy', 'id_proof'], claimedGata: String(c.gata), claimedArea: c.area, transferorName: c.seller, applicantName: c.buyer, deedBuyerName: b, record, submittedAt: bundle.app.submitted_at, slaDays: 45 }).filter((f) => f.code === 'name_variant')];
    const caught = bundle.flags.some((f) => f.severity !== 'low') || out.discrepancies.length > 0;
    if (c.problem) { seeded++; if (caught) found++; } else { cleanN++; if (caught) falseFlags++; }
  }
  const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(0)}% (${a}/${b})`;
  console.log(`| Metric | Result |\n|---|---|\n| Field extraction accuracy (gata, area) | ${pct(fieldOk, fieldTotal)} |\n| Discrepancy recall (rules + AI) | ${pct(found, seeded)} |\n| False-flag rate on clean cases | ${pct(falseFlags, cleanN)} |\n| Fallback activation | ${pct(fallbacks, cases.length)} |\n| Mode | ${process.env.LLM_API_KEY ? 'LLM' : 'fallback only (no LLM_API_KEY)'} |`);
}
main();
