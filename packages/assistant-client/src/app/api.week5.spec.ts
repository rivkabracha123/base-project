import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStaffLeadPipeline, updateStaffLeadPipeline } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('staff lead pipeline API', () => {
  it('reads only the staff pipeline data needed by the dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'reviewing',
      nextAction: 'Review the matching lots.',
      statusHistory: [{ at: '2026-09-01T10:00:00.000Z', from: 'new', to: 'reviewing' }],
      activityNotes: [{ at: '2026-09-01T10:00:00.000Z', text: 'Opened for review.' }],
      payload: { contact: { email: 'never-expose@example.test' } },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const pipeline = await getStaffLeadPipeline('buyer-lead-001');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/staff-operations/leads/buyer-lead-001/pipeline', { signal: undefined });
    expect(pipeline).toEqual({
      status: 'reviewing',
      nextAction: 'Review the matching lots.',
      statusHistory: [{ at: '2026-09-01T10:00:00.000Z', from: 'new', to: 'reviewing' }],
      activityNotes: [{ at: '2026-09-01T10:00:00.000Z', text: 'Opened for review.' }],
    });
  });

  it('saves one approved status change and a short note through the staff API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'reviewing', nextAction: null, statusHistory: [], activityNotes: [],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await updateStaffLeadPipeline('buyer-lead-001', { status: 'reviewing', note: 'Opened for review.' });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/staff-operations/leads/buyer-lead-001/pipeline', expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewing', note: 'Opened for review.' }),
    }));
  });
});
