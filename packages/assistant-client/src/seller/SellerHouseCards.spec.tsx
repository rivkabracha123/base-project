import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { houseRankingSchema } from '@monabid/shared';
import { SellerHouseCards } from './SellerHouseCards';
import { sellerMessageSchema } from './messages';
import i18n from '../i18n';
import { createSellerLead, grantP3ServiceConsent, rankHousesForLead, saveSellerHouseChoice } from '../app/api';

vi.mock('../app/api', () => ({ createSellerLead: vi.fn(), grantP3ServiceConsent: vi.fn(), rankHousesForLead: vi.fn(), saveSellerHouseChoice: vi.fn() }));

const house = { id: 'demo-rings', name: 'Ring specialist', active: true, categories: ['rings'], languages: ['he', 'en'], geography: 'Israel', comparableSoldCountByCategory: { rings: 3 } };
const ranking = houseRankingSchema.parse({ recommendation: { house, score: 10, reasons: ['Category match'] }, alternatives: [{ house: { ...house, id: 'wrong', name: 'Book specialist', categories: ['rare_books'] }, score: 5, reasons: ['Other category'] }], excluded: [] });

describe('seller house cards', () => {
  beforeEach(() => vi.resetAllMocks());
  it('saves and changes a house choice inside the chat while reusing the draft lead', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(grantP3ServiceConsent).mockResolvedValue({ id: 'profile' } as never);
    vi.mocked(createSellerLead).mockResolvedValue('lead-1');
    vi.mocked(rankHousesForLead).mockResolvedValue(ranking);
    vi.mocked(saveSellerHouseChoice).mockResolvedValue({ houseId: house.id, houseName: house.name, source: 'seller' });
    const alternative = { ...ranking.recommendation!, house: { ...house, id: 'alternate', name: 'Alternative house' } };
    render(<MemoryRouter><SellerHouseCards ranking={{ ...ranking, alternatives: [alternative] }} category="rings" language="en" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Save house choice' }));
    expect(await screen.findByText('Choice saved: Ring specialist')).toBeInTheDocument();
    vi.mocked(saveSellerHouseChoice).mockResolvedValue({ houseId: 'alternate', houseName: 'Alternative house', source: 'seller' });
    fireEvent.click(screen.getByRole('radio', { name: /Alternative house/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save house choice' }));
    expect(await screen.findByText('Choice saved: Alternative house')).toBeInTheDocument();
    await waitFor(() => expect(saveSellerHouseChoice).toHaveBeenLastCalledWith('lead-1', 'alternate'));
    expect(createSellerLead).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
  it('preserves ranking data through message validation and shows only category specialists', async () => {
    await i18n.changeLanguage('en');
    const message = sellerMessageSchema.parse({ id: 'm1', sessionId: 's1', speaker: 'system', text: 'Houses', houseRanking: ranking });
    expect(message.speaker === 'system' && message.houseRanking).toEqual(ranking);
    render(<MemoryRouter><SellerHouseCards ranking={ranking} category="rings" language="en" /></MemoryRouter>);
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Ring specialist' })).toBeInTheDocument();
    expect(screen.queryByText('Book specialist')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save house choice' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('DEMO data only')).toBeInTheDocument();
  });
});
