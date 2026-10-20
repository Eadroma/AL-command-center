export type IncidentKind = 'death' | 'movement' | 'runtime' | 'deployment' | 'stock' | 'inventory' | 'availability' | 'commerce' | 'drift' | 'solo';
export type IncidentSeverity = 'warning' | 'error';

export interface Incident {
  id: string;
  character: string;
  kind: IncidentKind;
  severity: IncidentSeverity;
  title: string;
  details: string;
  firstAt: number;
  lastAt: number;
  occurrences: number;
  resolvedAt?: number;
  resolved: boolean;
}

export interface IncidentResolutionsResponse {
  resolutions: Record<string, number>;
}
