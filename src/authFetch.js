// Bound authentication, including response bodies. The SDK treats network errors
// as retryable and retains the session; never turn an outage into a sign-out.
export function createAuthFetch(fetchImpl, timeoutMs = 30_000) {
  return async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!url.pathname.startsWith('/auth/v1/')) return fetchImpl(input, options);
    const controller = new AbortController();
    const signal = options.signal || input.signal;
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(input, { ...options, signal: controller.signal });
          const bytes = await response.arrayBuffer();
          return new Response([204, 205, 304].includes(response.status) ? null : bytes,
            { status: response.status, statusText: response.statusText, headers: response.headers });
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new TypeError('Session connection timed out. Please retry.'));
            controller.abort();
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}
