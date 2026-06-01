import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { CapabilityManifest, Marketplace } from "../../marketplace"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const CapabilitiesResponse = z
  .object({
    data: CapabilityManifest.array(),
  })
  .meta({ ref: "MarketplaceCapabilitiesResponse" })

export const MarketplaceRoutes = lazy(() =>
  new Hono()
    .get(
      "/capabilities",
      describeRoute({
        summary: "Marketplace capabilities",
        description: "Returns built-in and installed RAILWISE capabilities.",
        operationId: "marketplace.capabilities.list",
        responses: {
          200: {
            description: "Marketplace capabilities",
            content: {
              "application/json": {
                schema: resolver(CapabilitiesResponse),
              },
            },
          },
          ...errors(500),
        },
      }),
      async (c) => c.json({ data: Marketplace.list() }),
    )
    .get(
      "/capabilities/:id",
      describeRoute({
        summary: "Marketplace capability",
        operationId: "marketplace.capabilities.get",
        responses: {
          200: {
            description: "Marketplace capability",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404, 500),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const item = Marketplace.get(c.req.valid("param").id)
        if (!item) return c.json({ error: "capability not found" }, 404)
        return c.json(item)
      },
    )
    .post(
      "/capabilities/:id/enable",
      describeRoute({
        summary: "Enable capability",
        operationId: "marketplace.capabilities.enable",
        responses: {
          200: {
            description: "Enabled capability",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404, 500),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const item = await Marketplace.setEnabled(c.req.valid("param").id, true)
        if (!item) return c.json({ error: "capability not found" }, 404)
        return c.json(item)
      },
    )
    .post(
      "/capabilities/:id/disable",
      describeRoute({
        summary: "Disable capability",
        operationId: "marketplace.capabilities.disable",
        responses: {
          200: {
            description: "Disabled capability",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404, 500),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const item = await Marketplace.setEnabled(c.req.valid("param").id, false)
        if (!item) return c.json({ error: "capability not found" }, 404)
        return c.json(item)
      },
    ),
)
