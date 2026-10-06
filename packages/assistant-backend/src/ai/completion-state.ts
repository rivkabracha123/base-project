export type FieldStatus = 'provided' | 'skipped' | 'missing' | 'uncertain';

export type FieldCompletion = {
  required: boolean;
  status: FieldStatus;
  value: unknown;
};

export type CompletionState = {
  fields: Record<string, FieldCompletion>;
  blockingFields: string[];
  readyForFunctions: boolean;
};

export function isCompletionState(value: unknown): value is CompletionState {
  if (!value || typeof value !== 'object') return false;

  const state = value as Record<string, unknown>;
  if (!state.fields || typeof state.fields !== 'object' || !Array.isArray(state.blockingFields) || typeof state.readyForFunctions !== 'boolean') {
    return false;
  }

  const fields = state.fields as Record<string, unknown>;
  return Object.entries(fields).every(([name, field]) => {
    if (!name || !field || typeof field !== 'object') return false;
    const entry = field as Record<string, unknown>;
    return (
      typeof entry.required === 'boolean' &&
      (entry.status === 'provided' || entry.status === 'skipped' || entry.status === 'missing' || entry.status === 'uncertain') &&
      Object.prototype.hasOwnProperty.call(entry, 'value')
    );
  }) && state.blockingFields.every((field) => typeof field === 'string');
}

export function buildCompletionState(fields: Record<string, FieldCompletion>): CompletionState {
  const blockingFields = Object.entries(fields)
    .filter(([, field]) => field.required && (field.status === 'missing' || field.status === 'uncertain'))
    .map(([name]) => name);

  return {
    fields,
    blockingFields,
    readyForFunctions: blockingFields.length === 0,
  };
}
