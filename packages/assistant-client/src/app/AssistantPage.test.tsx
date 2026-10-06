import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { AssistantPage } from './AssistantPage';

const fetchMock = vi.fn();
const conversationId = '7ee08402-2de0-4cda-a2fb-7c46c80bfcba';
const response = {
  provider: 'fixture', mode: 'fixture', isRelevant: true, error: null,
  content: 'fixture response', summary: 'Seller summary', recommendation: 'Add evidence',
  nextAction: 'Provide dimensions', confidence: 'low',
  structuredAnswer: { role: 'seller', missingFacts: ['dimensions'], price: { min: 5000, max: 8000, currency: 'ILS' } },
};
function renderPage() {
  return render(<I18nextProvider i18n={i18n}><AssistantPage /></I18nextProvider>);
}
describe('AssistantPage conversations', () => {
  beforeEach(async () => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    await i18n.changeLanguage('en');
  });

  it('continues a dialogue and omits the ID only when starting a new conversation', async () => {
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true, json: async () => url.includes('/ai/history')
        ? { items: [], total: 0, page: 1, pageSize: 20 }
        : { ...response, conversationId, exchangeId: crypto.randomUUID() },
    }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Seller' }));
    fireEvent.change(screen.getByLabelText('Your request'), { target: { value: 'A painting to sell' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Seller summary');
    expect(screen.getByLabelText('Your request')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Buyer' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Your request'), { target: { value: 'Dimensions are 20 by 30 cm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findAllByText('Seller summary').then(async () => {
      await vi.waitFor(() => expect(screen.getAllByText('Seller summary')).toHaveLength(2));
    });
    const calls = fetchMock.mock.calls.filter(([url]) => url.includes('/ai/generate'));
    expect(JSON.parse(calls[0]![1].body).conversationId).toBeUndefined();
    expect(JSON.parse(calls[1]![1].body).conversationId).toBe(conversationId);
    expect(within(screen.getByRole('list', { name: 'Conversation messages' })).getAllByText('dimensions')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(screen.queryByText('Seller summary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buyer' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Your request'), { target: { value: 'Another painting' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Seller summary');
    const lastCall = fetchMock.mock.calls.filter(([url]) => url.includes('/ai/generate')).at(-1)!;
    expect(JSON.parse(lastCall[1].body).conversationId).toBeUndefined();
  });

  it('reopens all user and assistant turns after remount', async () => {
    const entries = ['First request', 'Follow-up request'].map((prompt, index) => ({
      id: crypto.randomUUID(), conversationId, userId: 'user-1', prompt,
      role: 'seller', language: 'en', createdAt: '2026-09-15T08:00:00.000Z',
      response: { ...response, summary: 'Saved answer ' + index },
    }));
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true, json: async () => url.includes('/ai/conversations/')
        ? { conversationId, entries }
        : { items: entries, total: 2, page: 1, pageSize: 20 },
    }));
    const first = renderPage();
    await screen.findByRole('button', { name: /First request/ });
    first.unmount();
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /First request/ }));
    await screen.findByText('Saved answer 0');
    expect(screen.getByText('Saved answer 1')).toBeInTheDocument();
    const dialogue = within(screen.getByRole('list', { name: 'Conversation messages' }));
    expect(dialogue.getByText('First request')).toBeInTheDocument();
    expect(dialogue.getByText('Follow-up request')).toBeInTheDocument();
    expect(screen.getByLabelText('Your request')).toHaveValue('');
  });
});
