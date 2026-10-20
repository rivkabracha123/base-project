import { guidedDimensions } from './guided-dimensions';

describe('guided measurements', () => {
  it('keeps decimal values and all three axes with their stated unit', () => {
    expect(guidedDimensions('10.5 x 20 x 30 mm')?.values).toEqual([
      { label: 'width', value: 10.5, unit: 'mm' },
      { label: 'height', value: 20, unit: 'mm' },
      { label: 'depth', value: 30, unit: 'mm' },
    ]);
  });
  it.each(['0x80 cm', '-70x80 cm', '70x-80 cm', 'from 2021', 'size 8'])('rejects invalid or unrelated text: %s', input => {
    expect(guidedDimensions(input)).toBeUndefined();
  });
});
