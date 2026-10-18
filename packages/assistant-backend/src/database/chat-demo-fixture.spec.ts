import { chatDemoHouses, chatDemoLots, demoCategories } from './chat-demo-fixture';
import { loadPreparedHouses } from '../seller-leads/house-rank-fixture';

describe('chat demo coverage', () => {
  it('provides linked specialists, searchable lots and three same-currency sales per category', () => {
    const houses = chatDemoHouses();
    const lots = chatDemoLots();
    expect(lots).toHaveLength(28);
    for (const { category } of demoCategories) {
      expect(houses.filter(house => house.categories.includes(category))).toHaveLength(2);
      const rows = lots.filter(lot => lot.category === category);
      expect(rows.filter(lot => lot.status === 'sold')).toHaveLength(3);
      expect(new Set(rows.map(lot => lot.itemKey)).size).toBe(1);
      for (const lot of rows) {
        expect(lot.source.provider).toBe('synthetic-development-demo');
        expect(houses.some(house => house.id === lot.auctionHouse.id)).toBe(true);
        expect(lot.description.en).toContain('DEMO ONLY');
      }
    }
  });

  it('requires explicit demo opt-in and disables fictional recommendations in production', () => {
    const previous = { demo: process.env.CHAT_DEMO_DATA, node: process.env.NODE_ENV };
    try {
      process.env.CHAT_DEMO_DATA = 'true';
      process.env.NODE_ENV = 'development';
      expect(loadPreparedHouses()).toHaveLength(14);
      process.env.NODE_ENV = 'production';
      expect(loadPreparedHouses().some(house => house.id.startsWith('demo-house-'))).toBe(false);
    } finally {
      if (previous.demo === undefined) delete process.env.CHAT_DEMO_DATA;
      else process.env.CHAT_DEMO_DATA = previous.demo;
      if (previous.node === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous.node;
    }
  });
});
