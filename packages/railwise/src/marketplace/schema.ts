import z from "zod"

export const CapabilityKind = z
  .enum(["agent", "tool", "skill", "workflow", "mcp", "provider", "harness_profile"])
  .meta({ ref: "CapabilityKind" })

export const CapabilityPermission = z
  .object({
    filesystem: z.enum(["none", "read", "write"]).default("none"),
    network: z.boolean().default(false),
    shell: z.boolean().default(false),
    external_directory: z.boolean().default(false),
    secrets: z.boolean().default(false),
  })
  .meta({ ref: "CapabilityPermission" })

export const CapabilityManifest = z
  .object({
    id: z.string(),
    kind: CapabilityKind,
    name: z.string(),
    description: z.string(),
    version: z.string(),
    source: z.enum(["builtin", "local", "remote"]),
    enabled: z.boolean(),
    installed: z.boolean(),
    permissions: CapabilityPermission,
    tags: z.string().array().default([]),
  })
  .meta({ ref: "CapabilityManifest" })

export type CapabilityKind = z.infer<typeof CapabilityKind>
export type CapabilityManifest = z.infer<typeof CapabilityManifest>
export type CapabilityPermission = z.infer<typeof CapabilityPermission>
