export * from "./client.js"
export * from "./server.js"

import { createRailwiseClient } from "./client.js"
import { createRailwiseServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createRailwise(options?: ServerOptions) {
  const server = await createRailwiseServer({
    ...options,
  })

  const client = createRailwiseClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
