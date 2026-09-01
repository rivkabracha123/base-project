import pinoHttp from 'pino-http';

// שדות פרטיים שאסור שיישמרו בלוגי בקשות.
export const HTTP_LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body',
  'res.headers["set-cookie"]',
];

export function createHttpLogger(level: string) {
  return pinoHttp({ level, redact: HTTP_LOG_REDACT_PATHS });
}
