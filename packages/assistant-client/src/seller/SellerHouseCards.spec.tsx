import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { houseRankingSchema } from '@monabid/shared';
import { SellerHouseCards } from './SellerHouseCards';
import { sellerMessageSchema } from './messages';
import i18n from '../i18n';

const house = { id: 'demo-rings', name: 'Ring specialist', active: true, categories: ['rings'], languages: ['he', 'en'], geography: 'Israel', comparableSoldCountByCategory: { rings: 3 } };
const ranking = houseRankingSchema.parse({ recommendation: { house, score: 10, reasons: ['Category match'] }, alternatives: [{ house: { ...house, id: 'wrong', name: 'Book specialist', categories: ['rare_books'] }, score: 5, reasons: ['Other category'] }], excluded: [] });

describe('seller house cards', () => {
  it('preserves ranking data through message validation and shows only category specialists', async () => {
    await i18n.changeLanguage('en');
    const message = sellerMessageSchema.parse({ id: 'm1', sessionId: 's1', speaker: 'system', text: 'Houses', houseRanking: ranking });
    expect(message.speaker === 'system' && message.houseRanking).toEqual(ranking);
    render(<MemoryRouter><SellerHouseCards ranking={ranking} category="rings" language="en" /></MemoryRouter>);
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Ring specialist' })).toBeInTheDocument();
    expect(screen.queryByText('Book specialist')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose auction house' })).toHaveAttribute('href', '/seller/houses');
    expect(screen.getByText('DEMO data only')).toBeInTheDocument();
  });
});
