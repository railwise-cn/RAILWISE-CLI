declare global {
  const RAILWISE_VERSION: string
  const RAILWISE_CHANNEL: string
}

export const VERSION = typeof RAILWISE_VERSION === "string" ? RAILWISE_VERSION : "local"
export const CHANNEL = typeof RAILWISE_CHANNEL === "string" ? RAILWISE_CHANNEL : "local"
