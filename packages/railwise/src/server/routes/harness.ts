import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Harness, HarnessEvent, HarnessPermissionDecision, HarnessPermissionResult, HarnessStatus } from "../../harness"
import { errors } from "../error"

export function HarnessRoutes() {
  return new Hono()
    .get(
      "/status",
      describeRoute({
        summary: "Get Harness status",
        description: "Return the current local Harness execution posture for Desktop.",
        operationId: "harness.status",
        responses: {
          200: {
            description: "Harness status",
            content: {
              "application/json": {
                schema: resolver(HarnessStatus),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => c.json(await Harness.status()),
    )
    .get(
      "/session/:sessionID/timeline",
      describeRoute({
        summary: "Get Harness session timeline",
        description: "Return normalized Harness events for one session.",
        operationId: "harness.timeline",
        responses: {
          200: {
            description: "Harness events",
            content: {
              "application/json": {
                schema: resolver(HarnessEvent.array()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => c.json(await Harness.timeline(c.req.valid("param").sessionID)),
    )
    .post(
      "/session/:sessionID/permission/:permissionID",
      describeRoute({
        summary: "Resolve Harness permission",
        description: "Record a user decision for a Harness permission request.",
        operationId: "harness.permission.resolve",
        responses: {
          200: {
            description: "Permission decision result",
            content: {
              "application/json": {
                schema: resolver(HarnessPermissionResult),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ sessionID: z.string(), permissionID: z.string() })),
      validator("json", HarnessPermissionDecision),
      (c) => {
        const param = c.req.valid("param")
        return c.json(Harness.resolvePermission(param.sessionID, param.permissionID, c.req.valid("json")))
      },
    )
}
