export interface ReplayFrame {
  at: number; map: string; x: number; y: number; hp: number; maxHp: number; mp: number; maxMp: number;
  target: string; intent: string; reason: string; movement: string;
  equipment?: Array<{ slot: string; name: string; level: number }>;
  blockedBy?: string; transaction?: string; server?: string;
  actions: Array<{ at: number; action: string; result: string }>;
}
export interface IncidentReplay {
  id: string; kind: 'death' | 'movement' | 'commerce' | 'runtime'; at: number; detail: string; frames: ReplayFrame[];
}
export interface ReplayState { recent: ReplayFrame[]; captures: IncidentReplay[]; seen: string[]; movement: string; }
