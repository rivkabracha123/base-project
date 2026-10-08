import { allowedNextStatuses, assertValidPipelineTransition } from './staff-lead-pipeline';

describe('staff lead pipeline', () => {
  it('allows only the approved forward transitions', () => {
    expect(allowedNextStatuses('new')).toEqual(['reviewing']);
    expect(allowedNextStatuses('reviewing')).toEqual(['contacted']);
    expect(allowedNextStatuses('contacted')).toEqual(['qualified']);
    expect(allowedNextStatuses('qualified')).toEqual(['item_found']);
    expect(allowedNextStatuses('item_found')).toEqual(['negotiating']);
    expect(allowedNextStatuses('negotiating')).toEqual(['won', 'lost', 'closed']);
  });

  it('does not allow skipping a pipeline step or changing a terminal outcome', () => {
    expect(() => assertValidPipelineTransition('new', 'qualified')).toThrow('Invalid staff lead status transition');
    expect(() => assertValidPipelineTransition('won', 'closed')).toThrow('Invalid staff lead status transition');
  });
});
