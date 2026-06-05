import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { CapabilityManifest, Marketplace } from "../../marketplace"
import { errors } from "../error"

const CapabilityList = z
  .object({
    data: CapabilityManifest.array(),
  })
  .meta({ ref: "CapabilityList" })

export function MarketplaceRoutes() {
  return new Hono()
    .get(
      "/capabilities",
      describeRoute({
        summary: "List marketplace capabilities",
        description: "Return built-in and installed capability manifests for Desktop Marketplace.",
        operationId: "marketplace.capabilities.list",
        responses: {
          200: {
            description: "Capability list",
            content: {
              "application/json": {
                schema: resolver(CapabilityList),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => c.json({ data: await Marketplace.list() }),
    )
    .get(
      "/capabilities/:id",
      describeRoute({
        summary: "Get marketplace capability",
        description: "Return one capability manifest by id.",
        operationId: "marketplace.capabilities.get",
        responses: {
          200: {
            description: "Capability manifest",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const item = await Marketplace.get(c.req.valid("param").id)
        if (item) return c.json(item)
        return c.json({ name: "CapabilityNotFound", message: "Capability not found", data: { id: c.req.valid("param").id } }, { status: 404 })
      },
    )
    .post("/capabilities/:id/enable", validator("param", z.object({ id: z.string() })), async (c) => {
      const item = await Marketplace.enable(c.req.valid("param").id)
      if (item) return c.json(item)
      return c.json({ name: "CapabilityNotFound", message: "Capability not found", data: { id: c.req.valid("param").id } }, { status: 404 })
    })
    .post("/capabilities/:id/disable", validator("param", z.object({ id: z.string() })), async (c) => {
      const item = await Marketplace.disable(c.req.valid("param").id)
      if (item) return c.json(item)
      return c.json({ name: "CapabilityNotFound", message: "Capability not found", data: { id: c.req.valid("param").id } }, { status: 404 })
    })
}
