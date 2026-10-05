/** Inlined S5 demo data so week-5 handoff does not add JSON fixture files. */

export const sellerFinalLeadFixture = {
  id: 'seller-final-lead-catalog-draft',
  expectedOutcome:
    'The seller reviews the S1 catalog draft, S2 evidence, and S4 valuation, chooses an active house, then submits one internal SellerLead for the P5 dashboard without contacting a house.',
  item: {
    category: 'rare_books',
    geography: 'United States',
    preferredLanguage: 'en',
  },
  catalogDraft: {
    he: 'מחקר נוף מופשט',
    en: 'Abstract landscape study',
  },
  confirmedItem: {
    id: 'item-001',
    category: 'paintings',
    title: 'Abstract landscape study',
    evidenceIds: ['evidence-001'],
  },
  evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
  valuation: {
    status: 'supported' as const,
    reportId: 'valuation-001',
    comparableCount: 1,
    confidence: {
      level: 'low' as const,
      explanation:
        'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
    },
    limitations: [
      'Historical fixture rates and supplied evidence only; no current-market or growth adjustment.',
    ],
    comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
    excludedComparables: [] as Array<{ id: string; reason: string }>,
    valuationRange: { min: 800, max: 1200, currency: 'USD' as const },
  },
  chosenHouseId: 'house-kedem',
  expectedRecommendationId: 'house-kestenbaum',
  request: {
    profileId: 'profile-synthetic-seller-1',
    contact: {
      preferredName: 'Synthetic Seller',
      email: 'synthetic.seller@example.test',
    },
    serviceConsent: true,
  },
  handoff: {
    catalogDraft: {
      he: 'מחקר נוף מופשט',
      en: 'Abstract landscape study',
    },
    item: {
      id: 'item-001',
      category: 'paintings',
      title: 'Abstract landscape study',
      evidenceIds: ['evidence-001'],
    },
    evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
    valuation: {
      status: 'supported' as const,
      reportId: 'valuation-001',
      comparableCount: 1,
      confidence: {
        level: 'low' as const,
        explanation:
          'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
      },
      limitations: [
        'Historical fixture rates and supplied evidence only; no current-market or growth adjustment.',
      ],
      comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
      excludedComparables: [] as Array<{ id: string; reason: string }>,
      valuationRange: { min: 800, max: 1200, currency: 'USD' as const },
    },
  },
  failure: {
    missingContact: {
      preferredName: '',
      email: '',
      phone: '',
    },
    unsupportedClaims: {
      he: 'עמלה 15%',
      en: 'We will accept 15% commission',
    },
  },
};

export const sellerLeadDashboardDetailFixture = {
  id: 'seller-lead-dashboard-detail',
  expectedOutcome:
    'P5 reads one privacy-limited SellerLead dashboard detail by leadId without querying seller or valuation tables.',
  leadId: '11111111-1111-4111-8111-111111111111',
  dashboardDetail: {
    leadId: '11111111-1111-4111-8111-111111111111',
    status: 'submitted' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    item: {
      id: 'item-001',
      category: 'paintings',
      title: 'Abstract landscape study',
      evidenceIds: ['evidence-001'],
    },
    evidence: [{ id: 'evidence-001', type: 'seller_statement' }],
    comparables: [{ id: 'comp-001', source: 'prepared-fixture' }],
    valuation: {
      status: 'supported' as const,
      reportId: 'valuation-001',
      comparableCount: 1,
      confidence: {
        level: 'low' as const,
        explanation:
          'Confidence is uncalibrated; low is a conservative default pending expert review, not a probability.',
      },
      limitations: [
        'Historical fixture rates and supplied evidence only; no current-market or growth adjustment.',
      ],
      comparables: [{ id: 'comp-001', source: { label: 'prepared-fixture', url: null } }],
      excludedComparables: [] as Array<{ id: string; reason: string }>,
      valuationRange: { min: 800, max: 1200, currency: 'USD' as const },
    },
    recommendation: {
      house: {
        id: 'house-kestenbaum',
        name: 'Kestenbaum & Company',
        active: true,
        categories: ['rare_books'],
        languages: ['en'],
        comparableSoldCountByCategory: { rare_books: 4 },
      },
      score: 11,
      reasons: ['Prepared house lists specialization in rare_books'],
    },
    alternatives: [
      {
        house: {
          id: 'house-kedem',
          name: 'Kedem Auction House',
          active: true,
          categories: ['judaica', 'rare_books'],
          languages: ['he', 'en'],
          comparableSoldCountByCategory: { rare_books: 1 },
        },
        score: 7,
        reasons: ['Prepared house lists specialization in rare_books'],
      },
    ],
    sellerChoice: {
      houseId: 'house-kedem',
      houseName: 'Kedem Auction House',
      source: 'seller' as const,
    },
    catalogDraft: {
      he: 'מחקר נוף מופשט',
      en: 'Abstract landscape study',
    },
    contact: {
      preferredName: 'Synthetic Seller',
      email: 'synthetic.seller@example.test',
      phone: null,
      serviceConsentGranted: true,
    },
    history: [{ at: '2026-01-01T00:00:00.000Z', event: 'submitted' as const, actor: 'seller' as const }],
  },
};
