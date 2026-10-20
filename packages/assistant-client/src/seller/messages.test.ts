import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectSellerLevels, getPendingSellerEvidenceItemId, sendSellerMessage } from './connect-seller-levels';
import type { SellerUpdate } from '../chat/chat-types';
import i18n from '../i18n';
import { resetSellerCatalogReview } from './seller-catalog-review';

vi.mock('./connect-seller-correction', () => ({
  getCurrentSellerDraft: vi.fn(),
  correctSellerDraftField: vi.fn(),
}));

const currentProfile = {
  id: 'profile-current',
  sessionId: 'anonymous-session',
  language: 'en',
  serviceConsent: { granted: false },
  marketingConsent: { granted: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('connectSellerLevels', () => {
  it('redirects unrelated input before questions or function execution', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ai: { isRelevant: false, summary: 'I can help with buying or selling items at auction.' },
        nextQuestion: { field: 'dimensions', he: 'מידות?', en: 'Dimensions?' },
        functionCall: { functionToRun: 'rankSellerHouses', object: {} },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();
    await connectSellerLevels('I want a cake recipe', callback);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: 'I can help with buying or selling items at auction.' });
  });
  it('refreshes the visible card after a direct Hebrew title correction', async () => {
    const updatedDraft = { item: { title: 'כתב יד עתיק למכירה', category: 'rare_books' }, evidence: [] };
    const { correctSellerDraftField } = await import('./connect-seller-correction');
    vi.mocked(correctSellerDraftField).mockResolvedValue(updatedDraft as never);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ requiredMissingFields: [], nextQuestion: null }), { status: 200 })));
    const onDraftReady = vi.fn();

    await connectSellerLevels('תשנה את השם לכתב יד עתיק למכירה', vi.fn(), onDraftReady, true);

    expect(correctSellerDraftField).toHaveBeenCalledWith('title', { en: 'כתב יד עתיק למכירה' });
    expect(onDraftReady).toHaveBeenCalledWith(updatedDraft);
  });
  it('shows only the drafted description text, then asks whether to save or update it', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ functionCall: { functionToRun: 'getSellerCatalogDraft', object: { sessionId: 'session-1' } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { title: 'Manuscript', he: 'טיוטה', en: 'Drafted catalog text' } }), { status: 200 })));
    const callback = vi.fn();
    try {
      await connectSellerLevels('Write a catalog description', callback);
      expect(callback).toHaveBeenCalledTimes(2);
      const [shown, question] = callback.mock.calls.map((call) => call[0]);
      expect(shown).toEqual({ speaker: 'system', text: expect.stringMatching(/^(?:טיוטה|Drafted catalog text)$/) });
      expect(question.text).toMatch(/לשמור את התיאור בפרטי הפריט, או לעדכן אותו\?|save this description to your item details, or update it\?/);
    } finally {
      resetSellerCatalogReview();
    }
  });
  it('shows the editable enquiry draft as an action card without requesting contact details yet', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: {
        draft: { item: {
          id: 'item-1',
          category: 'rare_books',
          title: 'Manuscript',
          evidenceIds: [],
          catalogDraft: { he: 'כתב יד', en: 'Manuscript' },
          description: { he: 'כתב יד', en: 'Manuscript' },
          materials: [],
          dimensions: { values: [] },
          source: 'seller-intake',
        }, evidence: [] },
        enquiryText: 'Please review this manuscript.',
        generatedByAi: true,
      } }), { status: 200 })));
    const callback = vi.fn();
    await connectSellerLevels('Create an enquiry', callback);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ kind: 'enquiry', enquiryText: 'Please review this manuscript.', generatedByAi: true }),
    }));
    expect(callback).not.toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringMatching(/send your name/i) }));
  });
  it('does not replace a sale-history request with an auction-house offer', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ requiredMissingFields: [], nextQuestion: null,
        functionCall: { functionToRun: 'getSellerComparableHistory', object: { sessionId: 'seller-session' } },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { criteria: { category: 'rings' }, lots: [] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();
    await connectSellerLevels('I want previous sales', callback);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: 'Past sales of similar items',
      comparison: { mode: 'history', criteria: { category: 'rings' }, lots: [] } });
  });
  it('does not ask optional questions once required intake fields are complete', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ nextQuestion: null,
        requiredMissingFields: [], missingFields: ['marks', 'signatures', 'provenance'],
        ai: { nextAction: 'What is its provenance?' },
      }), { status: 200 })));
    const callback = vi.fn();
    await connectSellerLevels('Good condition', callback);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: 'Your item details are saved.' });
  });
  it('displays a requested function result without appending optional intake questions', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        requiredMissingFields: [], missingFields: ['provenance'],
        nextQuestion: { field: 'provenance', en: 'Where did it come from?', he: 'Optional question' },
        functionCall: { functionToRun: 'listEvidence', object: { itemId: 'item-1' } },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();
    await connectSellerLevels('List my images', callback);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: '0 saved images.' });
  });
  it('does not repeat model questions after all intake details are collected', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nextQuestion: null, missingFields: [], ai: { nextAction: 'What is its condition?' },
      }), { status: 200 })));
    const callback = vi.fn();
    await connectSellerLevels('No', callback);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: 'Your item details are saved.' });
  });
  it.each([
    { categories: ['paintings'], expected: 'Recommended auction house: Test House.' },
    { categories: ['rare_books'], expected: 'No auction house specializing in this category was found in the available data.' },
  ])('displays the actual house ranking without claiming an unsupported specialization', async ({ categories, expected }) => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        functionCall: { functionToRun: 'rankSellerHouses', object: { category: 'paintings' } },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: {
        recommendation: { house: { name: 'Test House', categories }, reasons: ['Any wording'] }, alternatives: [],
      } }), { status: 200 })));
    const callback = vi.fn();
    await connectSellerLevels('Which auction houses are recommended?', callback);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: expected });
  });
  it('shows the AI next action after intake instead of the fixed review summary', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nextQuestion: null,
        ai: { summary: 'Your ring details are saved.', nextAction: 'Would you like auction-house recommendations?' },
        conversation: { assistantSummary: { en: 'The item is being reviewed.' } },
      }), { status: 200 })));
    const callback = vi.fn();
    await connectSellerLevels('No known history', callback);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: 'Your ring details are saved. Would you like auction-house recommendations?' });
  });
  it('keeps the AI explanation and recommendation when asking the next required question', async () => {
    await i18n.changeLanguage('he');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nextQuestion: { field: 'dimensions', he: 'כדי להמשיך, מה מידות הפריט?', en: 'What are the dimensions?' },
        ai: {
          summary: 'כתב היד עשוי לעניין אספנים.',
          recommendation: 'כדאי לבדוק אפשרות למכירה לאחר הערכת מומחה.',
          nextAction: 'כדי להמשיך, מה מידות הפריט?',
        },
      }), { status: 200 })));
    const callback = vi.fn();
    await connectSellerLevels('יש לי כתב יד עתיק ואני מתלבטת אם למכור אותו', callback);
    expect(callback).toHaveBeenCalledWith({
      speaker: 'system',
      text: 'כתב היד עשוי לעניין אספנים. כדאי לבדוק אפשרות למכירה לאחר הערכת מומחה. כדי להמשיך, מה מידות הפריט?',
    });
    await i18n.changeLanguage('en');
  });
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('sends seller text with internally managed ids and awaits the display callback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nextQuestion: { field: 'dimensions', he: 'מהן המידות?', en: 'What are the dimensions?' },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    let finishCallback: (() => void) | undefined;
    const callback = vi.fn((_update: SellerUpdate) => new Promise<void>((resolve) => {
      finishCallback = resolve;
    }));

    let finished = false;
    const operation = connectSellerLevels('  I have a painting  ', callback).then(() => { finished = true; });
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());

    expect(finished).toBe(false);
    expect(callback).toHaveBeenCalledWith({ speaker: 'system', text: 'What are the dimensions?' });
    const [profileUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [intakeUrl, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(profileUrl).toContain('/profiles/me');
    expect(intakeUrl).toContain('/seller-intake/draft');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(request.body))).toMatchObject({ input: 'I have a painting', language: 'en' });
    expect(JSON.parse(String(request.body)).profileId).toBe('profile-current');
    expect(JSON.parse(String(request.body)).sessionId).toBeTruthy();

    finishCallback?.();
    await operation;
    expect(finished).toBe(true);
  });

  it('reports and rejects empty messages without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();

    await expect(connectSellerLevels('  ', callback)).rejects.toThrow('יש להזין הודעה');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      speaker: 'error',
      code: 'SELLER_INTAKE_FAILED',
    }));
  });

  it('reports an API failure and rejects the returned promise', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const callback = vi.fn();

    await expect(connectSellerLevels('I have a painting', callback)).rejects.toThrow('503');
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      speaker: 'error',
      code: 'SELLER_INTAKE_FAILED',
    }));
  });

  it('dispatches a P4 function call to seller-workflow and displays a safe result message', async () => {
    const functionCall = { functionToRun: 'uploadEvidence', object: { itemId: 'item-1' } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nextQuestion: { field: 'photo', he: 'צרפי תמונה', en: 'Attach a photo' },
        functionCall,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        functionToRun: 'uploadEvidence',
        result: { status: 'client_action_required' },
      }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();

    await connectSellerLevels('Please add a photo', callback);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [intakeUrl, intakeRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    const intakeBody = JSON.parse(String(intakeRequest.body));
    const [workflowUrl, workflowRequest] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(intakeUrl).toContain('/seller-intake/draft');
    expect(intakeUrl).toContain('/seller-intake/draft');
    expect(workflowUrl).toContain('/seller-workflow/callback');
    expect(JSON.parse(String(workflowRequest.body))).toEqual({
      profileId: intakeBody.profileId,
      structuredAnswer: functionCall,
    });
    expect(intakeBody.profileId).toBe('profile-current');
    expect(getPendingSellerEvidenceItemId()).toBe('item-1');
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      speaker: 'system',
      text: expect.stringContaining('Attach the image using the photo attachment button.'),
    }));
  });

  it('reports and rejects a failed seller workflow callback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        functionCall: { functionToRun: 'listEvidence', object: {} },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();

    await expect(connectSellerLevels('Show my uploads', callback)).rejects.toThrow('503');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      speaker: 'error',
      code: 'SELLER_INTAKE_FAILED',
    }));
  });

  it('summarizes workflow results without exposing contact fields', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        functionCall: { functionToRun: 'listSellerLeads', object: {} },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [
        { leadId: 'lead-1', item: { title: 'Oil painting' }, contact: { email: 'private@example.test' } },
      ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();

    await connectSellerLevels('List my enquiries', callback);

    const text = callback.mock.calls.find(([update]) => update.speaker === 'system')?.[0].text;
    expect(text).toContain('Oil painting');
    expect(text).not.toContain('private@example.test');
  });
});

describe('sendSellerMessage', () => {
  it.each([
    [{ status: 'supported', valuationRange: { min: 100, max: 200, currency: 'USD' } }, 'Estimated value'],
    [{ status: 'refusal', reason: 'insufficient_comparable_sales' }, 'insufficient credible sale evidence'],
    [{ status: 'refusal', reason: 'missing_exchange_rate_data' }, 'Currency conversion data is missing'],
    [{ status: 'refusal', reason: 'unusable_range_requires_expert_review' }, 'requires expert review'],
  ])('displays a valuation result rather than the saved-details acknowledgment', async (result, expected) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(currentProfile), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ functionCall: { functionToRun: 'calculateSellerValuation', object: { sessionId: 'session-1' } }, requiredMissingFields: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const callback = vi.fn();
    await connectSellerLevels('Please estimate value', callback);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ speaker: 'system', text: expect.stringContaining(expected) }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('displays system text through Tamar\'s callback and waits for it', async () => {
    let resolveUpdate: (() => void) | undefined;
    const callback = vi.fn(() => new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    }));
    let finished = false;

    const sending = sendSellerMessage('Please describe the item.', callback).then(() => {
      finished = true;
    });

    expect(callback).toHaveBeenCalledWith({
      speaker: 'system',
      text: 'Please describe the item.',
    });
    expect(finished).toBe(false);

    resolveUpdate?.();
    await sending;
    expect(finished).toBe(true);
  });
});
