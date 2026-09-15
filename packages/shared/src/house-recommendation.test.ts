import { describe, expect, it } from 'vitest';
import {
  preparedAuctionHouseFixtureSchema,
  sellerChoiceSchema,
  sellerLeadDashboardDetailSchema,
  sellerLeadSummarySchema,
  submitSellerLeadSchema,
  dashboardValuationSchema,
} from './house-recommendation';

describe('preparedAuctionHouseFixtureSchema', () => {
  it('accepts the prepared active-house fixture', () => {
    const houses = [
      {
        id: 'house-kestenbaum',
        name: 'Kestenbaum & Company',
        active: true,
        categories: ['rare_books'],
        geography: 'United States',
        languages: ['en'],
        recentSaleDate: '2025-01-23',
        comparableSoldCountByCategory: { rare_books: 4 },
      },
    ];

    expect(preparedAuctionHouseFixtureSchema.parse(houses)).toHaveLength(houses.length);
  });
});

describe('sellerChoiceSchema', () => {
  it('accepts a seller override that is separate from the ranked recommendation', () => {
    expect(
      sellerChoiceSchema.parse({
        houseId: 'house-kedem',
        houseName: 'Kedem Auction House',
        source: 'seller',
      }),
    ).toEqual({
      houseId: 'house-kedem',
      houseName: 'Kedem Auction House',
      source: 'seller',
    });
  });
});

describe('submitSellerLeadSchema', () => {
  it('accepts a catalog draft plus S1 item, S2 evidence, and S4 valuation snapshot', () => {
    expect(
      submitSellerLeadSchema.parse({
        catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
        item: { id: 'item-001', category: 'paintings', title: 'Abstract landscape study', evidenceIds: ['evidence-001'] },
        evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
        valuation: {
          status: 'supported',
          reportId: 'valuation-001',
          comparableCount: 1,
          confidence: {
            level: 'low',
            explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
          },
          limitations: ['Historical fixture rates and supplied evidence only; no current-market or growth adjustment.'],
          comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
          excludedComparables: [],
          valuationRange: { min: 800, max: 1200, currency: 'USD' },
        },
      }),
    ).toMatchObject({ valuation: { status: 'supported' } });
  });
});

describe('sellerLeadSummarySchema', () => {
  it('accepts a submitted internal lead with catalog draft and history', () => {
    const summary = sellerLeadSummarySchema.parse({
      id: 'lead-1',
      profileId: 'profile-synthetic-seller-1',
      contact: { preferredName: 'Synthetic Seller', email: 'synthetic.seller@example.test' },
      recommendation: null,
      sellerChoice: { houseId: 'house-kedem', houseName: 'Kedem Auction House', source: 'seller' },
      catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
      item: { id: 'item-001', category: 'paintings', title: 'Abstract landscape study', evidenceIds: ['evidence-001'] },
      evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
      valuation: {
        status: 'refusal',
        reportId: 'valuation-refusal-001',
        reason: 'insufficient_evidence',
        comparableCount: 0,
        confidence: {
          level: 'low',
          explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
        },
        limitations: ['Insufficient sold comparables for a supported range.'],
        comparables: [],
        excludedComparables: [],
      },
      status: 'submitted',
      history: [{ at: '2026-01-01T00:00:00.000Z', event: 'submitted', actor: 'seller' }],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(summary.status).toBe('submitted');
    expect(summary.catalogDraft?.en).toBe('Abstract landscape study');
  });
});

describe('sellerLeadDashboardDetailSchema', () => {
  it('accepts a privacy-limited P5 detail payload without profile or conversation fields', () => {
    const detail = sellerLeadDashboardDetailSchema.parse({
      leadId: '11111111-1111-4111-8111-111111111111',
      status: 'submitted',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      item: { id: 'item-001', category: 'paintings', title: 'Abstract landscape study', evidenceIds: ['evidence-001'] },
      evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
      comparables: [{ id: 'comp-001', source: 'prepared-fixture' }],
      valuation: {
        status: 'supported',
        reportId: 'valuation-001',
        comparableCount: 1,
        confidence: {
          level: 'low',
          explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
        },
        limitations: ['Historical fixture rates and supplied evidence only; no current-market or growth adjustment.'],
        comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
        excludedComparables: [],
        valuationRange: { min: 800, max: 1200, currency: 'USD' },
      },
      recommendation: null,
      alternatives: [],
      sellerChoice: { houseId: 'house-kedem', houseName: 'Kedem Auction House', source: 'seller' },
      catalogDraft: { he: 'מחקר נוף מופשט', en: 'Abstract landscape study' },
      contact: {
        preferredName: 'Synthetic Seller',
        email: 'synthetic.seller@example.test',
        phone: null,
        serviceConsentGranted: true,
      },
      history: [{ at: '2026-01-01T00:00:00.000Z', event: 'submitted', actor: 'seller' }],
    });

    expect(detail.leadId).toBe('11111111-1111-4111-8111-111111111111');
    expect(detail.contact.serviceConsentGranted).toBe(true);
    expect(detail.contact.phone).toBeNull();
    expect(detail.valuation?.status).toBe('supported');
    expect(detail.valuation && 'comparableCount' in detail.valuation).toBe(true);
    expect(detail).not.toHaveProperty('profileId');
  });

  it('accepts a refusal DashboardValuationDto without a price range', () => {
    const valuation = dashboardValuationSchema.parse({
      status: 'refusal',
      reportId: 'valuation-refusal-001',
      reason: 'insufficient_comparable_sales',
      comparableCount: 0,
      confidence: {
        level: 'low',
        explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
      },
      limitations: ['Insufficient sold comparables for a supported range.'],
      comparables: [],
      excludedComparables: [{ id: 'comp-001', reason: 'not_sold' }],
    });
    expect(valuation.status).toBe('refusal');
    expect(valuation).not.toHaveProperty('valuationRange');
  });

  it('rejects a supported valuation without a USD range', () => {
    expect(() =>
      dashboardValuationSchema.parse({
        status: 'supported',
        reportId: 'valuation-001',
        comparableCount: 1,
        confidence: {
          level: 'low',
          explanation: 'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
        },
        limitations: ['Historical fixture rates and supplied evidence only.'],
        comparables: [],
        excludedComparables: [],
      }),
    ).toThrow();
  });

  it('rejects email or phone when serviceConsentGranted is false', () => {
    expect(() =>
      sellerLeadDashboardDetailSchema.parse({
        leadId: '11111111-1111-4111-8111-111111111111',
        status: 'submitted',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        item: null,
        evidence: [],
        comparables: [],
        valuation: null,
        recommendation: null,
        alternatives: [],
        sellerChoice: null,
        catalogDraft: null,
        contact: {
          preferredName: 'Synthetic Seller',
          email: 'synthetic.seller@example.test',
          phone: null,
          serviceConsentGranted: false,
        },
        history: [],
      }),
    ).toThrow();
  });
});
