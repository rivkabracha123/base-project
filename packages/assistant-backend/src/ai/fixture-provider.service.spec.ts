import { FixtureProviderService } from './fixture-provider.service';
//test fixture provider service
describe('FixtureProviderService', () => {
  it('returns a deterministic fixture response for a blue ring search', async () => {
    const service = new FixtureProviderService();

    const result = await service.generate({
      prompt: 'טבעת כחולה משנת 2021',
      language: 'he',
    });

    expect(result.provider).toBe('fixture');
    expect(result.mode).toBe('fixture');
    expect(result.content).toContain('טבעת כחולה');
    expect(result.content).toContain('2021');
  });
});
