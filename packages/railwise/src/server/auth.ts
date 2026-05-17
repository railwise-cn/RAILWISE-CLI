import { Flag } from "@/flag/flag"

export namespace ServerAuth {
  export function token(
    password = Flag.RAILWISE_SERVER_PASSWORD,
    username = Flag.RAILWISE_SERVER_USERNAME ?? "railwise",
  ) {
    if (!password) return undefined
    return Buffer.from(`${username}:${password}`).toString("base64")
  }

  export function decode(token: string | undefined) {
    if (!token) return undefined
    const decoded = (() => {
      try {
        return Buffer.from(token, "base64").toString("utf8")
      } catch {
        return undefined
      }
    })()
    if (!decoded) return undefined
    const separator = decoded.indexOf(":")
    if (separator === -1) return undefined
    return {
      username: decoded.slice(0, separator) || "railwise",
      password: decoded.slice(separator + 1),
    }
  }

  export function authorized(input: { token: string | undefined; username: string; password: string }) {
    const decoded = decode(input.token)
    if (!decoded) return false
    return decoded.username === input.username && decoded.password === input.password
  }

  export function headers(
    password = Flag.RAILWISE_SERVER_PASSWORD,
    username = Flag.RAILWISE_SERVER_USERNAME ?? "railwise",
  ) {
    const value = token(password, username)
    if (!value) return undefined
    return {
      Authorization: `Basic ${value}`,
    }
  }
}
