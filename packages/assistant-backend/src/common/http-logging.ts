import type { Options } from 'pino-http';

/** Shared with the logging regression test so it exercises production options. */
export function httpLoggingOptions(level = 'info'): Options {
  return {
    level,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body',
      'req.url', 'res.headers["set-cookie"]'],
  };
}
