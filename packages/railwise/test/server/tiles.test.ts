import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { TilesRoutes } from "../../src/server/routes/tiles"
import { tmpdir } from "../fixture/fixture"

async function mbtiles(dir: string) {
  const root = path.join(dir, ".railwise")
  await fs.mkdir(root, { recursive: true })
  const db = new Database(path.join(root, "offline.mbtiles"))
  db.run("create table metadata (name text, value text)")
  db.run("create table tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)")
  db.query("insert into metadata values (?, ?)").run("format", "png")
  db.query("insert into tiles values (?, ?, ?, ?)").run(1, 1, 0, new Uint8Array([1, 2, 3]))
  db.close()
}

describe("server.routes.tiles", () => {
  test("serves local mbtiles with tms row lookup", async () => {
    await using tmp = await tmpdir()
    process.env.RAILWISE_TEST_HOME = tmp.path
    await mbtiles(tmp.path)

    const response = await TilesRoutes().request("http://railwise.test/1/1/1")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("x-railwise-tile-source")).toBe("local-mbtiles")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  test("returns 404 when offline cache is missing", async () => {
    await using tmp = await tmpdir()
    process.env.RAILWISE_TEST_HOME = tmp.path

    const response = await TilesRoutes().request("http://railwise.test/1/1/1")

    expect(response.status).toBe(404)
  })
})
