export interface OperationTransaction {
  id: string;
  character: string;
  kind: string;
  detail: string;
  state: 'committed' | 'failed';
  startedAt: number;
  finishedAt: number;
  message: string;
}

export interface CommerceEvent {
  id: string;
  character: string;
  side: 'sale' | 'purchase';
  item: string;
  level: number;
  quantity: number;
  unitPrice: number;
  goldDelta: number;
  at: number;
}

export interface OperationsHistoryResponse {
  hours: number;
  transactions: OperationTransaction[];
  commerce: CommerceEvent[];
}
