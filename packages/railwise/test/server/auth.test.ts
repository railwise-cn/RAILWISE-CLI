import { expect, test } from "bun:test"
import { ServerAuth } from "../../src/server/auth"

test("server auth headers include basic auth when password is set", () => {
  expect(ServerAuth.headers("secret")).toEqual({
    Authorization: `Basic ${Buffer.from("railwise:secret").toString("base64")}`,
  })
})

test("server auth headers use configured username", () => {
  expect(ServerAuth.headers("secret", "operator")).toEqual({
    Authorization: `Basic ${Buffer.from("operator:secret").toString("base64")}`,
  })
})

test("server auth headers are omitted when password is missing", () => {
  expect(ServerAuth.headers(undefined)).toBeUndefined()
})

test("server auth token decodes query credentials", () => {
  const token = Buffer.from("kit:secret").toString("base64")

  expect(ServerAuth.decode(token)).toEqual({ username: "kit", password: "secret" })
  expect(ServerAuth.authorized({ token, username: "kit", password: "secret" })).toBe(true)
  expect(ServerAuth.authorized({ token, username: "railwise", password: "secret" })).toBe(false)
})

test("server auth token defaults blank username to railwise", () => {
  const token = Buffer.from(":secret").toString("base64")

  expect(ServerAuth.decode(token)).toEqual({ username: "railwise", password: "secret" })
})
