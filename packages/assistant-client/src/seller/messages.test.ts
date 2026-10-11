import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectSellerLevels, getPendingSellerEvidenceItemId, sendSellerMessage } from './connect-seller-levels';
import type { SellerUpdate } from '../chat/chat-types';

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
    expect(JSON.parse(String(request.body))).toMatchObject({ input: 'I have a painting' });
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