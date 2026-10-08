// Tests the real fixture loader, without changing committed rates or using the network.
// Rates here are synthetic test inputs, not a claim about live market rates.
describe('Week 3: FX fixture integrity', () => {
  function load(raw: string) {
    let result: unknown;
    jest.isolateModules(() => {
      jest.doMock('node:fs', () => ({ ...jest.requireActual('node:fs'), readFileSync: jest.fn(() => raw) }));
      result = require('./valuation-calculation.fixtures').EXCHANGE_RATE_FIXTURES;
    });
    return result;
  }
  afterEach(() => { jest.dontMock('node:fs'); });

  it('preserves the full supplied FX precision and date', () => {
    expect(load('{"EUR":{"2024-03-10":1.23456789}}')).toEqual({ EUR: { '2024-03-10': 1.23456789 } });
  });
  it.each([0, -1, '1.25', null])('rejects invalid FX value %j at load time', rate => {
    expect(() => load(JSON.stringify({ EUR: { '2024-03-10': rate } }))).toThrow();
  });
  it('rejects a JSON number that overflows to Infinity', () => {
    expect(() => load('{"EUR":{"2024-03-10":1e309}}')).toThrow();
  });
  it.each(['null', '[]', '{"EUR":[]}', '{"EUR":null}', 'not-json'])('rejects malformed FX data %s', raw => {
    expect(() => load(raw)).toThrow();
  });
  it.each(['not-a-date', '2024-02-30'])('rejects invalid FX date %s', date => {
    expect(() => load(JSON.stringify({ EUR: { [date]: 1.25 } }))).toThrow();
  });
});
