import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStaffOperationLeads } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('staff dashboard seller-list handoff', () => {
  it('replaces legacy seller rows with the Seller dashboard UUID projection', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/staff-operations/leads')) {
        return Promise.resolve(new Response(JSON.stringify([
          {
            id: 'buyer-demand-1', type: 'buyer', clientName: 'Anonymous Demand', status: 'new',
            requestDetails: 'No matching result.', createdAt: '2026-10-24T10:00:00.000Z', pipelineAvailable: false,
          },
          {
            id: 'lead-3', type: 'seller', clientName: 'Legacy Seller', status: 'reviewing',
            requestDetails: 'Old seller row.', createdAt: '2026-10-23T10:00:00.000Z',
          },
        ]), { status: 200 }));
      }
      if (url.endsWith('/seller-leads/dashboard')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: '11111111-1111-4111-8111-111111111111', status: 'submitted', title: 'Silver menorah',
          category: 'judaica', createdAt: '2026-10-25T10:00:00.000Z', summary: 'A silver menorah for review.',
        }]), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getStaffOperationLeads()).resolves.toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111', type: 'seller', clientName: 'Anonymous Seller',
        status: 'submitted', category: 'judaica', requestDetails: 'A silver menorah for review.',
        createdAt: '2026-10-25T10:00:00.000Z', pipelineAvailable: false,
      },
      {
        id: 'buyer-demand-1', type: 'buyer', clientName: 'Anonymous Demand', status: 'new',
        requestDetails: 'No matching result.', createdAt: '2026-10-24T10:00:00.000Z', pipelineAvailable: false,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/seller-leads/dashboard', { signal: undefined });
  });

  it('keeps legacy seller rows visible while the new Seller endpoint has not been deployed', async () => {
    const legacySeller = {
      id: 'lead-3', type: 'seller', clientName: 'Legacy Seller', status: 'reviewing',
      requestDetails: 'Old seller row.', createdAt: '2026-10-23T10:00:00.000Z',
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/staff-operations/leads')) {
        return Promise.resolve(new Response(JSON.stringify([legacySeller]), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getStaffOperationLeads()).resolves.toEqual([legacySeller]);
  });
});
