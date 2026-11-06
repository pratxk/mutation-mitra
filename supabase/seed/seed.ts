import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const TEHSIL = 'सदर';
const PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
const USERS = [
  { email: 'lekhpal@demo.in', name: 'Ramesh Kumar', name_hi: 'रमेश कुमार', role: 'lekhpal' },
  { email: 'kanungo@demo.in', name: 'Sunita Devi', name_hi: 'सुनीता देवी', role: 'kanungo' },
  { email: 'tehsildar@demo.in', name: 'Anil Verma', name_hi: 'अनिल वर्मा', role: 'tehsildar' },
  { email: 'admin@demo.in', name: 'Admin', name_hi: 'प्रशासक', role: 'admin' },
] as const;

const VILLAGES = ['रामपुर', 'शिवगढ़', 'कुशलपुर', 'बरगदी', 'नौगाँव'];
const SELLERS = ['रामलाल', 'सुरेश कुमार', 'मोहम्मद अली', 'गीता देवी', 'हरिशंकर', 'बाबूराम', 'कमला देवी', 'इदरीस अहमद'];
const BUYERS = ['अजय सिंह', 'प्रमोद यादव', 'नसीम बानो', 'राजेश गुप्ता', 'सीमा देवी', 'विकास मिश्रा', 'दीपक वर्मा', 'अनीता राय'];

const DOCS = { sale: ['sale_deed', 'khatauni_copy', 'id_proof'], inheritance: ['death_cert', 'vanshavali', 'affidavit', 'id_proof'] };
type Stage = 'step1_intake' | 'step2_field' | 'step3_review' | 'step4_decision';

// stage distribution: 8/5/5/4 open + 3 decided (2 approved, 1 rejected) = 25
const PLAN: { stage: Stage; outcome?: 'approved' | 'rejected' }[] = [
  ...Array(8).fill({ stage: 'step1_intake' }), ...Array(5).fill({ stage: 'step2_field' }),
  ...Array(5).fill({ stage: 'step3_review' }), ...Array(4).fill({ stage: 'step4_decision' }),
  { stage: 'step4_decision', outcome: 'approved' }, { stage: 'step4_decision', outcome: 'approved' },
  { stage: 'step4_decision', outcome: 'rejected' },
];
// seeded problems on specific case indexes (the 8 hand-crafted edge cases)
const EDGE: Record<number, 'name_variant' | 'area_diff' | 'gata_mismatch' | 'missing_doc' | 'owner_mismatch'> = {
  0: 'name_variant', 1: 'area_diff', 2: 'gata_mismatch', 3: 'missing_doc', 4: 'owner_mismatch', 8: 'area_diff', 13: 'name_variant', 18: 'gata_mismatch',
};
const OVERDUE = new Set([0, 5, 9]);
const RETURNED = new Set([6, 14]);

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const deva = (n: number) => String(n).replace(/\d/g, (c) => '०१२३४५६७८९'[+c]);

async function user(u: (typeof USERS)[number]) {
  const { data, error } = await db.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw error;
  const id = data.user?.id ?? (await db.auth.admin.listUsers()).data.users.find((x) => x.email === u.email)!.id;
  await db.from('profiles').upsert({ id, name: u.name, name_hi: u.name_hi, role: u.role, tehsil: TEHSIL });
  return id;
}

async function main() {
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.role] = await user(u);

  await db.from('applications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('land_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  for (let i = 0; i < PLAN.length; i++) {
    const { stage, outcome } = PLAN[i];
    const edge = EDGE[i];
    const type = i % 4 === 3 ? 'inheritance' : 'sale';
    const village = VILLAGES[i % VILLAGES.length];
    const seller = SELLERS[i % SELLERS.length];
    const buyer = BUYERS[i % BUYERS.length];
    const gata = 100 + i * 7;
    const area = 800 + i * 55;

    const { data: rec } = await db.from('land_records').insert({
      village, khata_no: String(20 + i), gata_no: String(gata), area_sqm: area,
      owner_name: edge === 'owner_mismatch' ? 'तुलसीराम' : edge === 'name_variant' && i === 0 ? 'मुहम्मद अली' : seller, tehsil: TEHSIL,
    }).select().single();

    const claimedGata = edge === 'gata_mismatch' ? String(gata + 1) : deva(gata); // Devanagari numerals on purpose
    const claimedArea = edge === 'area_diff' ? Math.round(area * (i === 1 ? 1.15 : 1.05)) : area;
    const submitted = OVERDUE.has(i) ? 52 + i : 3 + ((i * 5) % 38);

    const { data: app } = await db.from('applications').insert({
      ref_no: `DK-2026-${String(100 + i).padStart(5, '0')}`, case_type: type, tehsil: TEHSIL, village,
      applicant_name: edge === 'name_variant' && i === 13 ? 'नसीम बानो' : buyer, transferor_name: i === 0 ? 'मोहम्मद अली' : seller,
      land_record_id: rec!.id, claimed_gata_no: claimedGata, claimed_area_sqm: claimedArea,
      stage, outcome: outcome ?? null, submitted_at: daysAgo(submitted),
      return_count: RETURNED.has(i) ? 1 : 0, decided_at: outcome ? daysAgo(1) : null,
      assigned_to: ids.lekhpal,
    }).select().single();
    const appId = app!.id;

    const docs = DOCS[type].filter((d) => !(edge === 'missing_doc' && d === DOCS[type][1]));
    await db.from('documents').insert(docs.map((d) => ({
      application_id: appId, doc_type: d,
      extracted_text: d === 'sale_deed' || d === 'vanshavali'
        ? `${d === 'sale_deed' ? 'बैनामा' : 'वंशावली'}: विक्रेता ${seller} ने क्रेता ${buyer} को ग्राम ${village} में गाटा संख्या ${claimedGata}, रकबा ${claimedArea} वर्ग मीटर, खाता ${20 + i} की भूमि बेची।`
        : `${d} — नमूना दस्तावेज़ (कृत्रिम)।`,
    })));

    await db.from('application_events').insert({
      application_id: appId, actor: null, actor_role: null, action: 'submitted', to_stage: 'step1_intake', at: daysAgo(submitted),
    });
    if (RETURNED.has(i)) {
      await db.from('application_events').insert({
        application_id: appId, actor: ids.kanungo, actor_role: 'kanungo', action: 'returned',
        from_stage: 'step3_review', to_stage: 'step2_field', reason: 'मौक़ा रिपोर्ट में सीमा विवरण अधूरा है।', at: daysAgo(Math.max(1, submitted - 5)),
      });
    }
    // Later-stage cases carry earlier step data so the UI has something to show.
    if (stage !== 'step1_intake') {
      await db.from('step_data').insert({ application_id: appId, stage: 'step1_intake', saved_by: ids.lekhpal, data: { confirmed: true, fields: { buyer_name: buyer } } });
    }
    if (stage === 'step3_review' || stage === 'step4_decision') {
      await db.from('step_data').insert({ application_id: appId, stage: 'step2_field', saved_by: ids.lekhpal, data: {
        raw_note: 'मौक़े पर कब्ज़ा विक्रेता का पाया गया। चारों ओर खेत हैं।',
        report: { possession: 'क्रेता/विक्रेता का कब्ज़ा', boundaries: 'चारों ओर खेत', structures: 'कोई नहीं', objections: i % 5 === 2 ? ['पड़ोसी ने सीमा पर आपत्ति जताई'] : [], persons_met: ['ग्राम प्रधान'], conclusion: 'मौक़ा निरीक्षण संतोषजनक' },
      } });
    }
    if (stage === 'step4_decision') {
      await db.from('step_data').insert({ application_id: appId, stage: 'step3_review', saved_by: ids.kanungo, data: { recommendation: 'approve', note: 'अभिलेख एवं मौक़ा रिपोर्ट अनुरूप।' } });
    }
    if (outcome) {
      await db.from('application_events').insert({
        application_id: appId, actor: ids.tehsildar, actor_role: 'tehsildar', action: outcome, from_stage: 'step4_decision',
        reason: outcome === 'rejected' ? 'स्वामित्व स्पष्ट नहीं' : null, meta: { final_text: 'आदेश (नमूना)' },
      });
    }
  }
  console.log(`seeded ${PLAN.length} cases; demo password: ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
