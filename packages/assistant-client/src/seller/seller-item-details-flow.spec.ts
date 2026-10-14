import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SellerItemDraft } from '@monabid/shared';
import { connectSellerLevels } from './connect-seller-levels';
import { getCurrentSellerDraft } from './connect-seller-correction';
import i18n from '../i18n';

vi.mock('./seller-ids', () => ({ getSellerMessageIds: vi.fn(async () => ({ profileId: 'p', sessionId: 's' })) }));
vi.mock('./connect-seller-correction', () => ({ getCurrentSellerDraft: vi.fn() }));

describe('saved seller item details', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(getCurrentSellerDraft).mockReset();
  });
  it.each(['calculateSellerValuation', 'getSellerCatalogDraft'])('supplies the browser session to %s despite missing model arguments', async functionName => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ functionCall: { functionToRun: functionName, object: { itemId: 'model-item' } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: functionName === 'calculateSellerValuation'
        ? { status: 'refusal', comparableCount: 0, lots: [] } : { title: 'Manuscript', he: 'טיוטה', en: 'Draft' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const update = vi.fn();
    try {
      await connectSellerLevels('אני רוצה הערכת שווי', update);
      expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ profileId: 'p',
        structuredAnswer: { functionToRun: functionName, object: { sessionId: 's' } } });
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ action: expect.objectContaining({ kind: functionName === 'calculateSellerValuation' ? 'valuation' : 'catalog' }) }));
    } finally { vi.unstubAllGlobals(); }
  });
  it('displays general auction advice without asking intake questions or showing the draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ai: { isRelevant: true, generalInformation: true, summary: 'A reserve is a minimum sale price.', recommendation: 'The item may remain unsold below it.', nextAction: 'Check the auction terms.' },
      requiredMissingFields: [], nextQuestion: { en: 'Dimensions?', he: 'מידות?' },
    }), { status: 200 })));
    const update = vi.fn();
    const showDraft = vi.fn();
    try {
      await connectSellerLevels('What is an auction reserve?', update, showDraft);
      expect(update).toHaveBeenCalledWith({ speaker: 'system', text: 'A reserve is a minimum sale price.\nThe item may remain unsold below it.\nCheck the auction terms.' });
      expect(showDraft).not.toHaveBeenCalled();
      expect(getCurrentSellerDraft).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('publishes the draft when required facts are complete but optional facts are missing', async () => {
    const draft = { item: { title: 'Manuscript' }, missingFields: ['marks', 'provenance'] } as SellerItemDraft;
    vi.mocked(getCurrentSellerDraft).mockResolvedValue(draft);
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      requiredMissingFields: [], missingFields: ['marks', 'provenance'],
      nextQuestion: { field: 'marks', he: 'סימונים?', en: 'Markings?' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const showDraft = vi.fn();
    try {
      await connectSellerLevels('Good condition', vi.fn(), showDraft);
      expect(showDraft).toHaveBeenCalledWith(draft);
      await connectSellerLevels('Tell me more', vi.fn(), showDraft, true);
      expect(showDraft).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
  it('ignores a readiness flag left by an earlier conversation when the card is not visible', async () => {
    sessionStorage.setItem('monabid.seller.itemDraftReady', 'true');
    const draft = { id: 'new-draft', item: { title: 'Manuscript' } } as SellerItemDraft;
    vi.mocked(getCurrentSellerDraft).mockResolvedValue(draft);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ requiredMissingFields: [] }), { status: 200 })));
    const showDraft = vi.fn();
    try {
      await connectSellerLevels('Good condition', vi.fn(), showDraft, false);
      expect(showDraft).toHaveBeenCalledWith(draft);
    } finally { vi.unstubAllGlobals(); }
  });
  it('does not publish the draft while required facts are missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      requiredMissingFields: ['condition'], missingFields: ['condition'],
    }), { status: 200 })));
    const showDraft = vi.fn();
    try {
      await connectSellerLevels('70x80 cm', vi.fn(), showDraft);
      expect(showDraft).not.toHaveBeenCalled();
      expect(getCurrentSellerDraft).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it.each(['אני רוצה פרטי פריט', 'פרטי הפריט', 'Show my item details'])('shows the saved draft despite missing optional facts: %s', async input => {
    const draft = { item: { title: 'Manuscript' }, missingFields: ['marks', 'provenance'] } as SellerItemDraft;
    vi.mocked(getCurrentSellerDraft).mockResolvedValue(draft);
    await i18n.changeLanguage('he');
    const update = vi.fn();
    const showDraft = vi.fn();
    await connectSellerLevels(input, update, showDraft);
    expect(showDraft).toHaveBeenCalledWith(draft);
    expect(update).toHaveBeenCalledWith({ speaker: 'system', text: 'פרטי הפריט שלך:' });
  });
  it('reports a missing draft instead of claiming that details were saved', async () => {
    vi.mocked(getCurrentSellerDraft).mockResolvedValue(null);
    const showDraft = vi.fn();
    await expect(connectSellerLevels('item details', vi.fn(), showDraft)).rejects.toThrow();
    expect(showDraft).not.toHaveBeenCalled();
  });
});
