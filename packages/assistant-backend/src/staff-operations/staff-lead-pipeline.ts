export const staffPipelineStatuses = [
  'new',
  'reviewing',
  'contacted',
  'qualified',
  'item_found',
  'negotiating',
  'won',
  'lost',
  'closed',
] as const;

export type StaffPipelineStatus = (typeof staffPipelineStatuses)[number];

export interface StaffStatusHistoryEntry {
  at: string;
  from: StaffPipelineStatus | null;
  to: StaffPipelineStatus;
}

export interface StaffActivityNote {
  at: string;
  text: string;
}

export interface StaffLeadPipeline {
  status: StaffPipelineStatus;
  nextAction: string | null;
  statusHistory: StaffStatusHistoryEntry[];
  activityNotes: StaffActivityNote[];
}

export interface UpdateStaffLeadPipelineInput {
  status?: StaffPipelineStatus;
  nextAction?: string | null;
  note?: string;
}

const nextStatuses: Record<StaffPipelineStatus, StaffPipelineStatus[]> = {
  new: ['reviewing'],
  reviewing: ['contacted'],
  contacted: ['qualified'],
  qualified: ['item_found'],
  item_found: ['negotiating'],
  negotiating: ['won', 'lost', 'closed'],
  won: [],
  lost: [],
  closed: [],
};

export function allowedNextStatuses(status: StaffPipelineStatus): StaffPipelineStatus[] {
  return nextStatuses[status];
}

export function assertValidPipelineTransition(current: StaffPipelineStatus, next: StaffPipelineStatus): void {
  if (!allowedNextStatuses(current).includes(next)) {
    throw new Error(`Invalid staff lead status transition: ${current} -> ${next}`);
  }
}

export function normalizePipelineStatus(status: string): StaffPipelineStatus {
  const legacyStatuses: Record<string, StaffPipelineStatus> = {
    pending: 'new',
    in_progress: 'reviewing',
    completed: 'closed',
    draft: 'new',
    drafted: 'new',
    submitted: 'reviewing',
  };
  if ((staffPipelineStatuses as readonly string[]).includes(status)) return status as StaffPipelineStatus;
  return legacyStatuses[status] ?? 'new';
}
