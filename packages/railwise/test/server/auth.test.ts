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
