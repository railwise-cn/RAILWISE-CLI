import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { CapabilityManifest, Marketplace } from "../../marketplace"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const CapabilityParam = z.object({
  id: z.string(),
})

const CapabilityList = z
  .object({
    data: CapabilityManifest.array(),
  })
  .meta({ ref: "CapabilityList" })

export const MarketplaceRoutes = lazy(() =>
  new Hono()
    .get(
      "/capabilities",
      describeRoute({
        summary: "List marketplace capabilities",
        description: "List built-in, local, and remote RAILWISE capabilities available to the Harness.",
        operationId: "marketplace.capabilities",
        responses: {
          200: {
            description: "Capability list",
            content: {
              "application/json": {
                schema: resolver(CapabilityList),
              },
            },
          },
        },
      }),
      async (c) => c.json({ data: await Marketplace.list() }),
    )
    .get(
      "/capabilities/:id",
      describeRoute({
        summary: "Get marketplace capability",
        description: "Get a single RAILWISE capability manifest.",
        operationId: "marketplace.capability.get",
        responses: {
          200: {
            description: "Capability manifest",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", CapabilityParam),
      async (c) => {
        const item = await Marketplace.get(c.req.valid("param").id)
        if (!item) return c.json({ message: "Capability not found" }, { status: 404 })
        return c.json(item)
      },
    )
    .post(
      "/capabilities/:id/enable",
      describeRoute({
        summary: "Enable marketplace capability",
        description: "Enable an installed RAILWISE capability for the active Harness.",
        operationId: "marketplace.capability.enable",
        responses: {
          200: {
            description: "Enabled capability manifest",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", CapabilityParam),
      async (c) => {
        const current = await Marketplace.get(c.req.valid("param").id)
        if (!current) return c.json({ message: "Capability not found" }, { status: 404 })
        if (!current.installed) return c.json({ message: "Capability is not installed" }, { status: 409 })

        const item = await Marketplace.set(c.req.valid("param").id, true)
        if (!item) return c.json({ message: "Capability not found" }, { status: 404 })
        return c.json(item)
      },
    )
    .post(
      "/capabilities/:id/disable",
      describeRoute({
        summary: "Disable marketplace capability",
        description: "Disable an installed RAILWISE capability for the active Harness.",
        operationId: "marketplace.capability.disable",
        responses: {
          200: {
            description: "Disabled capability manifest",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", CapabilityParam),
      async (c) => {
        const current = await Marketplace.get(c.req.valid("param").id)
        if (!current) return c.json({ message: "Capability not found" }, { status: 404 })
        if (!current.installed) return c.json({ message: "Capability is not installed" }, { status: 409 })

        const item = await Marketplace.set(c.req.valid("param").id, false)
        if (!item) return c.json({ message: "Capability not found" }, { status: 404 })
        return c.json(item)
      },
    )
    .post(
      "/capabilities/:id/install",
      describeRoute({
        summary: "Install marketplace capability",
        description: "Install a RAILWISE capability so it can be enabled in the active Harness.",
        operationId: "marketplace.capability.install",
        responses: {
          200: {
            description: "Installed capability manifest",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", CapabilityParam),
      async (c) => {
        const item = await Marketplace.install(c.req.valid("param").id)
        if (!item) return c.json({ message: "Capability not found" }, { status: 404 })
        return c.json(item)
      },
    )
    .post(
      "/capabilities/:id/uninstall",
      describeRoute({
        summary: "Uninstall marketplace capability",
        description: "Uninstall a RAILWISE capability and remove it from the active Harness.",
        operationId: "marketplace.capability.uninstall",
        responses: {
          200: {
            description: "Uninstalled capability manifest",
            content: {
              "application/json": {
                schema: resolver(CapabilityManifest),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", CapabilityParam),
      async (c) => {
        const item = await Marketplace.uninstall(c.req.valid("param").id)
        if (!item) return c.json({ message: "Capability not found" }, { status: 404 })
        return c.json(item)
      },
    ),
)
