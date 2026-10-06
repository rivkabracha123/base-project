import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStaffOperationLeadDetail, StaffOperationLeadRequestError } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('getStaffOperationLeadDetail Week 4 seller contract', () => {
  it('calls Racheli’s Seller Lead endpoint and maps its frozen refusal contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      leadId: '22222222-2222-4222-8222-222222222222',
      status: 'submitted',
      createdAt: '2026-09-14T10:00:00.000Z',
      updatedAt: '2026-09-14T11:00:00.000Z',
      item: null,
      evidence: [],
      comparables: [],
      valuation: {
        status: 'refusal',
        reportId: 'report-002',
        comparableCount: 0,
        confidence: { level: 'low', explanation: 'Conservative default.' },
        limitations: ['No usable comparables.'],
        comparables: [],
        excludedComparables: [],
        reason: 'insufficient_comparables',
      },
      recommendation: null,
      alternatives: [],
      sellerChoice: null,
      catalogDraft: null,
      contact: {
        preferredName: 'Synthetic Seller',
        email: null,
        phone: null,
        serviceConsentGranted: false,
      },
      history: [],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const detail = await getStaffOperationLeadDetail('22222222-2222-4222-8222-222222222222', 'seller');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/seller-leads/22222222-2222-4222-8222-222222222222',
      { signal: undefined },
    );
    expect(detail).toMatchObject({
      id: '22222222-2222-4222-8222-222222222222',
      type: 'seller',
      valuation: { status: 'refusal', reason: 'insufficient_comparables' },
      contact: { email: null, phone: null, serviceConsentGranted: false },
    });
  });

  it('parses a supported seller dashboard detail without private fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'seller',
      status: 'submitted',
      createdAt: '2026-09-14T10:00:00.000Z',
      updatedAt: '2026-09-14T11:00:00.000Z',
      item: { title: 'Synthetic silver menorah', category: 'judaica' },
      evidence: [{ id: 'evidence-001', type: 'image' }],
      comparables: [{ id: 'sale-001', source: { label: 'Source unavailable', url: null } }],
      valuation: {
        status: 'supported',
        reportId: 'report-001',
        valuationRange: { min: 1200, max: 1800, currency: 'USD' },
      },
      recommendation: { houseName: 'Synthetic Auction House', reason: 'Judaica focus' },
      alternatives: [],
      sellerChoice: { houseName: 'Synthetic Auction House' },
      catalogDraft: { title: 'Synthetic silver menorah' },
      contact: {
        preferredName: 'Synthetic Seller',
        email: 'seller.demo@example.test',
        phone: null,
        serviceConsentGranted: true,
      },
      history: [{ at: '2026-09-14T11:00:00.000Z', event: 'submitted', actor: 'seller' }],
      profileId: 'never-expose-profile-id',
      sessionId: 'never-expose-session-id',
      marketingConsent: true,
      evidencePath: '/private/evidence.jpg',
    }), { status: 200 })));

    const detail = await getStaffOperationLeadDetail('11111111-1111-4111-8111-111111111111', 'seller');

    expect(detail).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'seller',
      valuation: { status: 'supported' },
    });
    expect(detail).not.toHaveProperty('profileId');
    expect(detail).not.toHaveProperty('sessionId');
    expect(detail).not.toHaveProperty('marketingConsent');
    expect(detail).not.toHaveProperty('evidencePath');
  });

  it.each([400, 404])('keeps the Seller Lead API status %i for the dashboard', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));

    await expect(getStaffOperationLeadDetail('11111111-1111-4111-8111-111111111111', 'seller'))
      .rejects.toEqual(expect.objectContaining({
        constructor: StaffOperationLeadRequestError,
        status,
      }));
  });
});
