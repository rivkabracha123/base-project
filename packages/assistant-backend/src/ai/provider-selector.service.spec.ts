import { ProviderSelectorService } from './provider-selector.service';
//test provider selector service
describe('ProviderSelectorService', () => {
  it('returns the configured provider kind unchanged', () => {
    const service = new ProviderSelectorService();

    expect(service.select('fixture')).toBe('fixture');
    expect(service.select('real')).toBe('real');
  });
});
