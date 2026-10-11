import { emptyBuyerCriteria } from './buyer-criteria';
import { toBuyerSearchStatusMessage } from './buyer-search-status-message';

// B3 -> B1: the chat only ever gets a plain found/not-found status, never lots or the search request.
// id/sessionId are B1's to attach when the message joins the conversation, not B3's to return.
describe('toBuyerSearchStatusMessage', () => {
  it('reports results-found in English when the search returned results', () => {
    expect(toBuyerSearchStatusMessage({ kind: 'results' }, { language: 'en' })).toEqual({
      speaker: 'results-found',
      text: 'Results found',
    });
  });

  it('reports results-found in Hebrew when the search returned results', () => {
    expect(toBuyerSearchStatusMessage({ kind: 'results' }, { language: 'he' }).text).toBe(
      'נמצאו תוצאות',
    );
  });

  it('reports no-results in English when the search found nothing', () => {
    expect(toBuyerSearchStatusMessage({ kind: 'unmatched' }, { language: 'en' })).toEqual({
      speaker: 'no-results',
      text: 'No results found',
    });
  });

  it('reports no-results in Hebrew when the search found nothing', () => {
    expect(toBuyerSearchStatusMessage({ kind: 'unmatched' }, { language: 'he' }).text).toBe(
      'לא נמצאו תוצאות',
    );
  });

  it('never includes lots, the search request, id, or sessionId — only speaker and text', () => {
    const message = toBuyerSearchStatusMessage({ kind: 'results' }, { language: 'he' });
    expect(Object.keys(message).sort()).toEqual(['speaker', 'text']);
  });

  it('tells the buyer in English which requested criteria were not filtered', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.periods = ['19th century'];
    criteria.media = ['painting'];

    expect(toBuyerSearchStatusMessage({ kind: 'results' }, { language: 'en', criteria }).text).toBe(
      'Results found. Not filtered by: period, medium.',
    );
  });

  it('tells the buyer in Hebrew which requested criteria were not filtered', () => {
    const criteria = emptyBuyerCriteria('he');
    criteria.geography = ['ישראל'];

    expect(toBuyerSearchStatusMessage({ kind: 'unmatched' }, { language: 'he', criteria }).text).toBe(
      'לא נמצאו תוצאות. לא סוננו לפי: מיקום.',
    );
  });

  it('adds no note when every requested criterion was filtered', () => {
    const criteria = emptyBuyerCriteria('en');
    criteria.categories = ['rare_books'];

    expect(toBuyerSearchStatusMessage({ kind: 'results' }, { language: 'en', criteria }).text).toBe(
      'Results found',
    );
  });
});
