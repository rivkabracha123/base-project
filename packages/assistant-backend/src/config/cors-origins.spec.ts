import { corsOrigins } from './cors-origins';

describe('corsOrigins', () => {
  it('allows loopback aliases while preserving the frontend protocol and port', () => {
    expect(corsOrigins('http://localhost:5173')).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
    ]);
    expect(corsOrigins('http://127.0.0.1:5173')).toContain('http://localhost:5173');
  });

  it('keeps nonlocal origins restricted to the configured host', () => {
    expect(corsOrigins('https://monabid.example')).toEqual(['https://monabid.example']);
  });
});
