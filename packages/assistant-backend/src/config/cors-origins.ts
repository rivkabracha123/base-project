/** Allow equivalent loopback hosts for the configured local frontend port. */
export function corsOrigins(configuredOrigin: string, allowVitePorts = false): Array<string | RegExp> {
  const origin = new URL(configuredOrigin);
  const origins: Array<string | RegExp> = [origin.origin];

  if (['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      origin.hostname = hostname;
      origins.push(origin.origin);
    }

    // Vite automatically chooses another port when its default port is busy.
    // In development, accept that local origin while keeping production exact.
    if (allowVitePorts && origin.protocol === 'http:') {
      origins.push(/^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/);
    }
  }

  return [...new Set(origins)];
}
