const orig = globalThis.fetch
// @ts-ignore
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  orig(input, { ...init, tls: { ...(init as any)?.tls, rejectUnauthorized: false } } as RequestInit)
