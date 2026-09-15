import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStaffOperationLeadDetail } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('getStaffOperationLeadDetail', () => {
  it('strips internal profile fields from a dashboard buyer lead response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'buyer-lead-privacy-001',
      type: 'buyer',
      status: 'new',
      criteria: { category: 'rare_hebrew_manuscript' },
      hardConstraints: [
        { field: 'budget.max', operator: 'lte', value: 15000, reason: 'buyer budget' },
      ],
      results: [],
      unmatchedDemand: null,
      contact: {
        preferredName: 'Synthetic Buyer',
        email: null,
        phone: null,
        followUpStatus: 'consent_required',
        serviceConsent: { granted: false },
      },
      profileId: 'internal-profile-id',
      sessionId: 'internal-session-id',
      marketingConsent: { granted: true },
      fullConversation: ['private conversation'],
    }), { status: 200 })));

    const detail = await getStaffOperationLeadDetail('buyer-lead-privacy-001');

    expect(detail).not.toHaveProperty('profileId');
    expect(detail).not.toHaveProperty('sessionId');
    expect(detail).not.toHaveProperty('marketingConsent');
    expect(detail).not.toHaveProperty('fullConversation');
    expect(detail.contact).toEqual({
      preferredName: 'Synthetic Buyer',
      email: null,
      phone: null,
      followUpStatus: 'consent_required',
      serviceConsent: { granted: false },
    });
  });
});
