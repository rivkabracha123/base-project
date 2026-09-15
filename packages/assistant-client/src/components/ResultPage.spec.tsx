import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useLocation, MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { unmatchedSearchOutcomeFixture } from '../app/buyer-search-outcome.fixture';
import i18n from '../i18n';
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
