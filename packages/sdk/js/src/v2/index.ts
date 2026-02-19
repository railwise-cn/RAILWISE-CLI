export * from "./client.js"
export * from "./server.js"

import { createYonsoonClient } from "./client.js"
import { createYonsoonServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createYonsoon(options?: ServerOptions) {
  const server = await createYonsoonServer({
    ...options,
  })

  const client = createYonsoonClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
