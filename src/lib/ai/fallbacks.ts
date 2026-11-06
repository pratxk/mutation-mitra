import type { CaseBundle } from '../case';
import type { DraftOrderOutput, ExtractOutput, StructureNoteOutput, SummarizeOutput } from './schemas';

const SEV_HI = { high: 'गंभीर', medium: 'मध्यम', low: 'सामान्य' } as const;
const FLAG_HI: Record<string, string> = {
  missing_doc: 'दस्तावेज़ अनुपलब्ध', gata_mismatch: 'गाटा संख्या में अंतर', area_diff: 'रकबे में अंतर',
  name_variant: 'नाम की वर्तनी में अंतर', owner_mismatch: 'विक्रेता अभिलेख के स्वामी से भिन्न', sla_overdue: 'समय-सीमा पार',
};

export function fallbackExtract(b: CaseBundle): ExtractOutput {
  const text = b.docs.map((d) => d.extracted_text ?? '').join('\n');
  const grab = (re: RegExp) => { const m = text.match(re); return m ? { value: m[1], source_quote: m[0], confidence: 0.5 } : { value: null, source_quote: null, confidence: 0 }; };
  return {
    fields: {
      buyer_name: grab(/(?<!वि)क्रेता\s+(.+?)\s+को/),
      gata_no: grab(/गाटा\s*(?:संख्या)?\s*[:\-]?\s*([0-9०-९]+(?:\/[^\s,।]+)?)/),
      area_sqm: grab(/([0-9०-९.]+)\s*(?:वर्ग\s*मीटर|वर्गमीटर)/),
    },
    discrepancies: b.flags.filter((f) => f.code !== 'sla_overdue').map((f) => ({
      field: f.code, deed_value: f.detail, record_value: '', note_hi: FLAG_HI[f.code] ?? f.code,
    })),
    missing_items_hi: b.flags.filter((f) => f.code === 'missing_doc').map((f) => `${f.detail} अनुपलब्ध`),
  };
}

export const fallbackStructure = (b: CaseBundle): StructureNoteOutput => ({
  possession: String(b.steps.step2_field?.raw_note ?? ''), boundaries: '', structures: '',
  objections: [], persons_met: [], conclusion: '', unclear_points_hi: ['स्वचालित व्यवस्थित करना उपलब्ध नहीं — कृपया स्वयं भरें'],
});

export function fallbackSummary(b: CaseBundle): SummarizeOutput {
  const risks = b.flags.map((f) => ({ title_hi: FLAG_HI[f.code] ?? f.code, severity: f.severity, evidence: f.detail }));
  return {
    summary_hi: `${b.app.ref_no}: ${b.app.applicant_name} द्वारा ग्राम ${b.app.village} में ${b.app.case_type === 'sale' ? 'बैनामा' : 'वरासत'} दाखिल-खारिज। ${risks.length ? `${risks.length} बिंदु जाँच योग्य (${risks.map((r) => `${r.title_hi}: ${SEV_HI[r.severity]}`).join('; ')})।` : 'कोई नियम-आधारित विसंगति नहीं मिली।'}`,
    risks,
    suggested_next_hi: risks.some((r) => r.severity === 'high') ? 'गंभीर बिंदुओं की जाँच कर निर्णय लें।' : 'अभिलेख मिलान के बाद संस्तुति दें।',
  };
}

const HEAD = (b: CaseBundle) => `प्रकरण संख्या ${b.app.ref_no}, ग्राम ${b.app.village}। आवेदक ${b.app.applicant_name}, पूर्व स्वामी ${b.app.transferor_name}।`;

export function fallbackOrder(b: CaseBundle, action = 'approve'): DraftOrderOutput {
  const tail = {
    approve: 'समस्त अभिलेखों की जाँच एवं स्थलीय निरीक्षण के उपरांत नामांतरण स्वीकृत किया जाता है।',
    reject: 'उपरोक्त कारणों से नामांतरण का प्रार्थना-पत्र अस्वीकृत किया जाता है। कारण: ____',
    return: 'प्रकरण पुनः जाँच हेतु पिछले चरण पर वापस भेजा जाता है। कारण: ____',
  }[action] ?? '';
  return { text_hi: `${HEAD(b)}\n${tail}` };
}
