import { Flag } from "@/flag/flag"

export namespace ServerAuth {
  export function headers(password = Flag.RAILWISE_SERVER_PASSWORD, username = Flag.RAILWISE_SERVER_USERNAME ?? "railwise") {
    if (!password) return undefined
    return {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    }
  }
}
