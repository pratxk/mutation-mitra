import { describe, expect, it } from 'vitest';
import { runRules } from '@/lib/rules';
import { normGata } from '@/lib/rules/normalize';
import { checkArea } from '@/lib/rules/area';
import { nameSimilarity } from '@/lib/rules/names';
import { bucketOf, priorityScore } from '@/lib/priority';
import { canAct, canStepBack } from '@/lib/workflow/permissions';

describe('rules', () => {
  it('normalises Devanagari numerals in gata', () => {
    expect(normGata('गाटा १२३/क')).toBe(normGata('गाटा 123/क'));
  });
  it('area thresholds', () => {
    expect(checkArea(101, 100)).toBeNull();
    expect(checkArea(105, 100)?.severity).toBe('medium');
    expect(checkArea(120, 100)?.severity).toBe('high');
  });
  it('name variants match, different names do not', () => {
    expect(nameSimilarity('मोहम्मद अली', 'मुहम्मद अली')).toBeGreaterThanOrEqual(0.85);
    expect(nameSimilarity('रामलाल', 'सुरेश कुमार')).toBeLessThan(0.4);
  });
  it('clean sale case has no flags', () => {
    const flags = runRules({
      caseType: 'sale', presentDocs: ['sale_deed', 'khatauni_copy', 'id_proof'],
      claimedGata: '१२३', claimedArea: 1000, transferorName: 'रामलाल', applicantName: 'सुरेश',
      record: { gata_no: '123', area_sqm: 1000, owner_name: 'रामलाल' },
      submittedAt: new Date().toISOString(), slaDays: 45,
    });
    expect(flags).toEqual([]);
  });
  it('flags missing doc, gata, overdue', () => {
    const flags = runRules({
      caseType: 'sale', presentDocs: ['sale_deed'], claimedGata: '124', claimedArea: 1000,
      transferorName: 'रामलाल', applicantName: 'सुरेश',
      record: { gata_no: '123', area_sqm: 1000, owner_name: 'रामलाल' },
      submittedAt: new Date(Date.now() - 50 * 86_400_000).toISOString(), slaDays: 45,
    }).map((f) => f.code);
    expect(flags).toEqual(expect.arrayContaining(['missing_doc', 'gata_mismatch', 'sla_overdue']));
  });
});

describe('priority', () => {
  it('buckets', () => {
    const now = new Date();
    const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
    const s = priorityScore({ submittedAt: ago(30), slaDays: 45, highFlags: 1, returnCount: 1, objection: true, now });
    expect(Math.round(s)).toBe(Math.round(100 * (30 / 45) + 15 + 5 + 10));
    expect(bucketOf(s, false)).toBe('soon');
    expect(bucketOf(100, false)).toBe('urgent');
    expect(bucketOf(10, false)).toBe('normal');
    expect(bucketOf(70, false)).toBe('soon');
    expect(bucketOf(10, true)).toBe('urgent');
  });
});

describe('permissions', () => {
  it('matrix', () => {
    expect(canAct('lekhpal', 'step1_intake', 'complete')).toBe(true);
    expect(canAct('kanungo', 'step1_intake', 'complete')).toBe(false);
    expect(canAct('lekhpal', 'step2_field', 'return')).toBe(false);
    expect(canAct('kanungo', 'step3_review', 'return')).toBe(true);
    expect(canAct('tehsildar', 'step4_decision', 'approve')).toBe(true);
    expect(canAct('kanungo', 'step4_decision', 'approve')).toBe(false);
    expect(canStepBack('lekhpal', 'step2_field')).toBe(true);
    expect(canStepBack('lekhpal', 'step1_intake')).toBe(false);
  });
});
