import { Database } from "bun:sqlite"
import { Hono } from "hono"
import { describeRoute, validator } from "hono-openapi"
import path from "path"
import z from "zod"
import { Global } from "../../global"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

type Tile = {
  tile_data: Uint8Array
}

type Metadata = {
  value: string
}

const Param = z.object({
  z: z.coerce.number().int().min(0).max(22),
  x: z.coerce.number().int().min(0),
  y: z.coerce.number().int().min(0),
})

let cached: { file: string; db: Database } | undefined

function file() {
  return path.join(Global.Path.home, ".railwise", "offline.mbtiles")
}

function client(file: string) {
  if (cached?.file === file) return cached.db
  cached?.db.close(false)
  cached = { file, db: new Database(file, { readonly: true }) }
  return cached.db
}

function format(db: Database) {
  const row = db.query("select value from metadata where name = ?").get("format") as Metadata | null
  return row?.value.toLowerCase() ?? "png"
}

function mime(format: string) {
  if (format === "jpg" || format === "jpeg") return "image/jpeg"
  if (format === "webp") return "image/webp"
  if (format === "pbf" || format === "mvt") return "application/x-protobuf"
  return "image/png"
}

function tile(db: Database, z: number, x: number, y: number) {
  const tms = 2 ** z - 1 - y
  return db
    .query(
      `
      select tile_data
      from tiles
      where zoom_level = ?
        and tile_column = ?
        and (tile_row = ? or tile_row = ?)
      order by case when tile_row = ? then 0 else 1 end
      limit 1
      `,
    )
    .get(z, x, tms, y, tms) as Tile | null
}

export const TilesRoutes = lazy(() =>
  new Hono().get(
    "/:z/:x/:y",
    describeRoute({
      summary: "离线地图瓦片",
      operationId: "tiles.get",
      responses: {
        200: { description: "MBTiles tile bytes" },
        ...errors(404, 500),
      },
    }),
    validator("param", Param),
    async (c) => {
      const source = file()
      if (!(await Bun.file(source).exists())) {
        return c.json({ message: "Offline tile cache missing", path: source }, 404)
      }

      const param = c.req.valid("param")
      const db = client(source)
      const row = tile(db, param.z, param.x, param.y)
      if (!row) return c.json({ message: "Tile not found" }, 404)

      const type = format(db)
      const body = new ArrayBuffer(row.tile_data.byteLength)
      new Uint8Array(body).set(row.tile_data)
      const headers: Record<string, string> = {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": mime(type),
        "X-Railwise-Tile-Source": "local-mbtiles",
      }
      if (type === "pbf" || type === "mvt") headers["Content-Encoding"] = "gzip"

      return new Response(body, { status: 200, headers })
    },
  ),
)
