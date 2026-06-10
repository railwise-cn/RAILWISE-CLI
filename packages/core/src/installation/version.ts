declare global {
  const RAILWISE_VERSION: string
  const RAILWISE_CHANNEL: string
}

export const InstallationVersion = typeof RAILWISE_VERSION === "string" ? RAILWISE_VERSION : "local"
export const InstallationChannel = typeof RAILWISE_CHANNEL === "string" ? RAILWISE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
