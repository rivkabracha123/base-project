import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import { HttpExceptionFilter } from './http-exception.filter';
import { httpLoggingOptions } from './http-logging';

describe('HTTP privacy boundaries', () => {
  it.each(['query', 'fragment', 'plain'])('preserves the route without sensitive %s content', kind => {
    const route = '/api/valuation-calculation/valuation';
    const suffix = kind === 'query' ? '?verificationCode=SYNTHETIC_PRIVATE_MARKER'
      : kind === 'fragment' ? '#SYNTHETIC_PRIVATE_MARKER' : '';
    let body: Record<string, unknown> = {};
    const response = { status: jest.fn().mockReturnThis(), json: (value: typeof body) => { body = value; } };
    const host = { switchToHttp: () => ({ getRequest: () => ({ url: route + suffix }),
      getResponse: () => response }) } as unknown as ArgumentsHost;
    new HttpExceptionFilter().catch(new BadRequestException('Invalid input'), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(body).toMatchObject({ statusCode: 400, path: route, message: 'Invalid input' });
    expect(JSON.stringify(body).includes('SYNTHETIC_PRIVATE_MARKER')).toBe(false);
  });

  it('redacts query values and credentials from actual HTTP request logs', async () => {
    const lines: string[] = [];
    const stream = new Writable({ write(chunk, _encoding, done) { lines.push(chunk.toString()); done(); } });
    const logger = pinoHttp(httpLoggingOptions(), stream);
    const server = createServer((req, res) => {
      logger(req, res);
      res.setHeader('set-cookie', 'session=SYNTHETIC_RESPONSE_MARKER');
      res.end('ok');
    });
    try {
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/api/valuation-calculation/valuation?verificationCode=SYNTHETIC_QUERY_MARKER`, {
        headers: { authorization: 'Bearer SYNTHETIC_AUTH_MARKER', cookie: 'session=SYNTHETIC_COOKIE_MARKER' },
      });
      await response.text();
      const output = lines.join('');
      expect(lines.length).toBeGreaterThan(0);
      for (const marker of ['SYNTHETIC_QUERY_MARKER', 'SYNTHETIC_AUTH_MARKER', 'SYNTHETIC_COOKIE_MARKER', 'SYNTHETIC_RESPONSE_MARKER']) {
        expect(output.includes(marker)).toBe(false);
      }
      const records = output.trim().split('\n').map(line => JSON.parse(line));
      expect(records.some(record => record.req?.url === '[Redacted]')).toBe(true);
      expect(records.some(record => record.res?.statusCode === 200)).toBe(true);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      stream.end();
    }
  });
});
