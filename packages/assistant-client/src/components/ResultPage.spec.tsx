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
  it('renders B3 fixture results and navigates to the selected lot', async () => {
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

  it('renders the current and historical groups supplied by B3', async () => {
    await i18n.changeLanguage('en');
    const upcomingLot = { ...unsoldLotFixture, status: 'upcoming' as const };
    render(
      <MemoryRouter>
        <ResultsPage
          outcome={{
            kind: 'results',
            searchRequest: resultsSearchOutcomeFixture.searchRequest,
            results: {
              current: [{ lot: upcomingLot, matchReasons: [] }],
              historical: [{ lot: soldLotFixture, matchReasons: [] }],
            },
            approvedRefinements: [],
          }}
        />
      </MemoryRouter>,
    );

    const currentResults = screen.getByRole('heading', { name: 'Current results' }).parentElement;
    const pastSales = screen.getByRole('heading', { name: 'Past sales' }).parentElement;
    expect(within(currentResults!).getByText('Unsold test lot')).toBeInTheDocument();
    expect(within(pastSales!).getByText('Sold test lot')).toBeInTheDocument();
  });

  it('does not render an empty current-results group', async () => {
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <ResultsPage
          outcome={{
            kind: 'results',
            searchRequest: resultsSearchOutcomeFixture.searchRequest,
            results: { current: [], historical: [{ lot: soldLotFixture, matchReasons: [] }] },
            approvedRefinements: [],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Past sales' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Current results' })).not.toBeInTheDocument();
  });

  it('shows match reasons, approved refinements, and the selected result', async () => {
    await i18n.changeLanguage('en');
    const upcomingLot = { ...unsoldLotFixture, status: 'upcoming' as const };
    render(
      <MemoryRouter>
        <ResultsPage
          outcome={{
            kind: 'results',
            searchRequest: resultsSearchOutcomeFixture.searchRequest,
            results: {
              current: [{ lot: upcomingLot, matchReasons: [{ field: 'creators', detail: 'Yitzhak Abrabanel' }] }],
              historical: [],
            },
            approvedRefinements: ['price'],
            selectedLotId: upcomingLot.id,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Why this matches')).toBeInTheDocument();
    expect(screen.getByText('Creator: Yitzhak Abrabanel')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Search was expanded without: price');
    expect(screen.getByLabelText('Selected item')).toBeInTheDocument();
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
