const pino = require('pino');
const { HTTP_LOG_REDACT_PATHS } = require('./http-logger');

describe('HTTP log privacy', () => {
  it('redacts authentication, cookies, request bodies, and set-cookie headers', () => {
    const writes: string[] = [];
    const logger = pino({ redact: HTTP_LOG_REDACT_PATHS }, { write: (line: string) => writes.push(line) });

    logger.info({
      req: {
        headers: { authorization: 'Bearer private-token', cookie: 'session=private-cookie' },
        body: { email: 'private@example.test', phone: '050-000-0000' },
      },
      res: { headers: { 'set-cookie': 'session=private-cookie' } },
    }, 'request completed');

    const output = writes.join('');
    expect(output).not.toContain('private-token');
    expect(output).not.toContain('private-cookie');
    expect(output).not.toContain('private@example.test');
    expect(output).not.toContain('050-000-0000');
    expect(output).toContain('[Redacted]');
  });
});
