/** Allow equivalent loopback hosts for the configured local frontend port. */
export function corsOrigins(configuredOrigin: string): string[] {
  const origin = new URL(configuredOrigin);
  const origins = [origin.origin];

  if (['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      origin.hostname = hostname;
      origins.push(origin.origin);
    }
  }

  return [...new Set(origins)];
}
