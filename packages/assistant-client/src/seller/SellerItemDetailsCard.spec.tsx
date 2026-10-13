import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SellerItemDraft } from '@monabid/shared';
import i18n from '../i18n';
import { SellerItemDetailsCard } from './SellerItemDetailsCard';
import { correctSellerDraftField } from './connect-seller-correction';

vi.mock('./connect-seller-correction', () => ({
  correctSellerDraftField: vi.fn(),
}));

const item: SellerItemDraft['item'] = {
  id: 'item-1',
  category: 'rings',
  title: 'Blue ring',
  titleTranslations: { he: 'טבעת כחולה', en: 'Blue ring' },
  description: { he: 'תיאור בעברית', en: 'English description' },
  materials: ['gold'],
  dimensions: { values: [{ label: 'ring size', value: 8, unit: 'ring_size' }] },
  condition: 'Good',
  markings: 'Inside stamp',
  signatures: 'None',
  provenance: 'Family collection',
  source: 'seller-intake',
  evidenceIds: [],
  catalogDraft: { he: '', en: '' },
};

const draft: SellerItemDraft = {
  id: 'draft-1',
  feature: 'seller-conversation',
  developer: 's1',
  week: 5,
  status: 'draft',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  language: { preferred: 'en', secondary: 'he', conversationMode: 'bilingual' },
  seller: { anonymousProfileId: 'profile-a', name: 'Seller', preferredName: 'Seller' },
  conversation: { prompt: { he: '', en: '' }, assistantSummary: { he: '', en: '' } },
  item,
  evidence: [],
  confirmedFacts: {},
  uncertainFacts: [],
  revisionHistory: [],
  missingFields: [],
  sellerConfirmation: { required: true, status: 'pending' },
  handoff: { to: ['s3', 's4', 's5'], status: 'ready_for_review' },
  safetyRules: {
    sellerConfirmsExtractedFacts: true,
    askForMissingDimensionsConditionMarksSignaturesAndProvenance: true,
    weakEvidenceNeverProducesInventedPrice: true,
    noHouseRecommendation: true,
    noValuation: true,
    noContactCapture: true,
  },
};

afterEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

describe('SellerItemDetailsCard', () => {
  it('shows the item summary and an editor in the active language', async () => {
    await i18n.changeLanguage('en');
    render(<SellerItemDetailsCard item={item} language="en" />);

    expect(screen.getByRole('heading', { name: 'Blue ring' })).toBeInTheDocument();
    expect(screen.getByText('English description')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));

    expect(screen.getByLabelText('Title')).toHaveValue('Blue ring');
    expect(screen.getByLabelText('Description')).toHaveValue('English description');
    expect(screen.getByLabelText('Dimensions')).toHaveValue('ring size: 8 ring_size');
    expect(screen.queryByLabelText('כותרת')).not.toBeInTheDocument();
  });

  it('uses Hebrew title and labels when the active language is Hebrew', async () => {
    await i18n.changeLanguage('he');
    render(<SellerItemDetailsCard item={item} language="he" />);

    expect(screen.getByRole('heading', { name: 'טבעת כחולה' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'עריכת פריט' }));

    expect(screen.getByLabelText('כותרת')).toHaveValue('טבעת כחולה');
    expect(screen.getByLabelText('תיאור')).toHaveValue('תיאור בעברית');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('rejects invalid measurement lines before calling the correction API', async () => {
    await i18n.changeLanguage('en');
    render(<SellerItemDetailsCard item={item} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));
    fireEvent.change(screen.getByLabelText('Dimensions'), { target: { value: 'not a measurement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter one measurement per line');
    expect(correctSellerDraftField).not.toHaveBeenCalled();
  });

  it('saves only the title translation for the active language', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(correctSellerDraftField).mockResolvedValue({
      ...draft,
      item: { ...item, title: 'New ring', titleTranslations: { he: 'טבעת כחולה', en: 'New ring' } },
    });
    render(<SellerItemDetailsCard item={item} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit item' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New ring' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(correctSellerDraftField).toHaveBeenCalledWith('title', { en: 'New ring' }));
    expect(await screen.findByRole('heading', { name: 'New ring' })).toBeInTheDocument();
  });
});
