import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useLocation, MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  resultsSearchOutcomeFixture,
  unmatchedSearchOutcomeFixture,
} from '../app/buyer-search-outcome.fixture';
import i18n from '../i18n';
import { soldLotFixture, unsoldLotFixture } from '../test/fixtures/auction-lots';
import { ResultsPage } from './ResultPage';

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}

describe('ResultsPage', () => {
  it('renders fixture results and navigates to the selected lot', async () => {
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsPage />
        <CurrentPath />
      </MemoryRouter>,
    );

    expect(screen.getByText('Atereth Zekeinim by Yitzhak Abrabanel')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'View item details' })[0]!);
    expect(screen.getByTestId('current-path')).toHaveTextContent('/lots/lot-kestenbaum-54554-121421');
  });

  it('groups sold lots as past sales and other lots as current results', async () => {
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <ResultsPage
          outcome={{
            kind: 'results',
            searchRequest: resultsSearchOutcomeFixture.searchRequest,
            items: [unsoldLotFixture, soldLotFixture],
          }}
        />
      </MemoryRouter>,
    );

    const currentResults = screen.getByRole('heading', { name: 'Current results' }).parentElement;
    const pastSales = screen.getByRole('heading', { name: 'Past sales' }).parentElement;

    expect(within(currentResults!).getByText('Unsold test lot')).toBeInTheDocument();
    expect(within(pastSales!).getByText('Sold test lot')).toBeInTheDocument();
  });

  it('does not render an empty current-results group when every lot is sold', async () => {
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <ResultsPage
          outcome={{
            kind: 'results',
            searchRequest: resultsSearchOutcomeFixture.searchRequest,
            items: [soldLotFixture],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Past sales' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Current results' })).not.toBeInTheDocument();
  });

  it('shows the B3 unmatched state without result cards or help capture', async () => {
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <ResultsPage outcome={unmatchedSearchOutcomeFixture} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('No matches found');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

});
