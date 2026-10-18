import pino from 'pino';
import { HTTP_LOG_REDACT_PATHS } from './http-logger';

describe('HTTP log privacy', () => {
  it('redacts authentication, session IDs, cookies, request bodies, and set-cookie headers', () => {
    const writes: string[] = [];
    const logger = pino(
      { redact: HTTP_LOG_REDACT_PATHS },
      { write: (line: string) => writes.push(line) },
    );

    logger.info(
      {
        req: {
          headers: {
            authorization: 'private-token',
            'x-anonymous-session-id': 'private-session-id',
            cookie: 'session=private-cookie',
          },
          body: {
            email: 'private@example.test',
            phone: '050-000-0000',
            conversation: 'private full conversation',
          },
        },
        res: { headers: { 'set-cookie': 'session=private-cookie' } },
      },
      'request completed',
    );

    const output = writes.join('');
    expect(output).not.toContain('private-token');
    expect(output).not.toContain('private-session-id');
    expect(output).not.toContain('private-cookie');
    expect(output).not.toContain('private@example.test');
    expect(output).not.toContain('050-000-0000');
    expect(output).not.toContain('private full conversation');
    expect(output).toContain('[Redacted]');
  });
});
