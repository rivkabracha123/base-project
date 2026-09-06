import { extractBuyerCriteriaFromFixture, mergeBuyerCriteria } from './buyer-criteria';

describe('BuyerCriteria extraction', () => {
  it('extracts a basic structured request from a fixture response', () => {
    const response = {
      provider: 'fixture' as const,
      mode: 'fixture' as const,
      content: 'The buyer wants a blue painting from the 19th century with a budget around $10k.',
      summary: 'המשתמש מחפש ציור כחול מתקופת המאה ה-19',
      recommendation: 'בקש פרטים נוספים על אמן ומיקום',
      nextAction: 'שאל על אמן ומיקום',
      confidence: 'medium' as const,
    };

    const result = extractBuyerCriteriaFromFixture(response);

    expect(result.category).toBe('painting');
    expect(result.color).toBe('blue');
    expect(result.period).toBe('19th');
    expect(result.budget).toEqual({ min: 10000, max: 10000 });
    expect(result.missing).toEqual(expect.arrayContaining(['creator', 'location']));
    expect(result.nextQuestion).toContain('creator');
  });

  it('preserves existing criteria while asking only for missing useful facts', () => {
    const existing = {
      budget: { min: 5000, max: 20000 },
      category: 'painting',
      creator: null,
      period: '19th',
      location: null,
      color: 'blue',
      notes: ['Existing request'],
      missing: ['creator', 'location'],
      nextQuestion: 'Do you want to refine the creator and location before I continue?',
    };

    const updated = mergeBuyerCriteria(existing, {
      location: 'Paris',
      notes: ['User clarified the location'],
    });

    expect(updated.budget).toEqual({ min: 5000, max: 20000 });
    expect(updated.location).toBe('Paris');
    expect(updated.missing).toEqual(['creator']);
    expect(updated.nextQuestion).toContain('creator');
  });

  it('handles complex fixture with ranges, multiple values, and missing fields', () => {
    const response = {
      provider: 'fixture' as const,
      mode: 'fixture' as const,
      content: 'Looking for sculpture, blue or red, from 1920-1930, budget $5k-$15k, location not specified, artist unknown.',
      summary: 'משתמש מחפש פסל כחול או אדום מהשנים 1920-1930, תקציב בין 5 ל- 15 קיי',
      recommendation: 'צריך להבהיר מיקום ואמן',
      nextAction: 'שאל על מיקום ואמן',
      confidence: 'medium' as const,
    };

    const result = extractBuyerCriteriaFromFixture(response);

    expect(result.category).toBe('sculpture');
    expect(result.period).toMatch(/1920|1930/); 
    expect(result.budget).toEqual(expect.objectContaining({
      min: expect.any(Number),
      max: expect.any(Number),
    }));
    
    expect(result.missing).toEqual(expect.arrayContaining(['creator', 'location']));
    expect(result.missing).not.toContain('category');
    expect(result.missing).not.toContain('period');
    expect(result.missing).not.toContain('budget');
    
    expect(result.nextQuestion).toMatch(/creator|location|artist/i);
  });
});
