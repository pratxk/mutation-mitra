export type Severity = 'high' | 'medium' | 'low';
export interface Flag {
  code: 'missing_doc' | 'gata_mismatch' | 'area_diff' | 'name_variant' | 'owner_mismatch' | 'sla_overdue';
  severity: Severity;
  detail: string;
}
