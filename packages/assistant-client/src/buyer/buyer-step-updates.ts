import { selectableHouses } from '../app/SellerJourneyChrome';
import type { OnUpdate } from './connect-levels';

type Language = 'he' | 'en';

// Step lines shown before a lookup's result, per kind of result, in the buyer's language.
export const BUYER_STEP_TEXTS = {
  houses: {
    searching: { he: 'מחפש בתי מכירות…', en: 'Searching auction houses…' },
    found: (count: number) => ({ he: `נמצאו ${count} בתי מכירות מתאימים`, en: `Found ${count} matching auction houses` }),
  },
  history: {
    searching: { he: 'מחפש מופעים קודמים של הפריט…', en: 'Searching previous appearances of the item…' },
    found: (count: number) => ({ he: `נמצאו ${count} מופעים קודמים של הפריט`, en: `Found ${count} previous appearances of the item` }),
  },
  trend: {
    searching: { he: 'משווה לעסקאות קודמות…', en: 'Comparing with past deals…' },
    found: (count: number) => ({ he: `נמצאו ${count} מחירים להשוואה`, en: `Found ${count} prices to compare` }),
  },
} as const;

// Wraps the buyer chat callback so auction houses, an item's sale history and a price trend are each
// introduced by a "searching…" line and a "found N…" line, like the lots search steps.
export function withBuyerSteps(onUpdate: OnUpdate, language: Language): OnUpdate {
  const steps = (kind: keyof typeof BUYER_STEP_TEXTS, count: number) => {
    onUpdate({ speaker: 'system', text: BUYER_STEP_TEXTS[kind].searching[language] });
    onUpdate({ speaker: 'results-found', text: BUYER_STEP_TEXTS[kind].found(count)[language] });
  };
  return (update) => {
    if (update.speaker === 'house-ranking') {
      steps('houses', selectableHouses(update.ranking).filter((row) => row.house.categories.includes(update.category)).length);
    } else if (update.speaker === 'sale-history') {
      steps('history', update.lots.filter((lot) => lot.status === 'sold').length);
    } else if (update.speaker === 'price-trend') {
      steps('trend', update.points.length);
    }
    onUpdate(update);
  };
}
