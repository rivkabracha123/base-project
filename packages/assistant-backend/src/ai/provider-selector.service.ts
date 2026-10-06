export type ProviderKind = 'fixture' | 'real';

export class ProviderSelectorService {
  select(kind: ProviderKind): ProviderKind {
    return kind;
  }
}
