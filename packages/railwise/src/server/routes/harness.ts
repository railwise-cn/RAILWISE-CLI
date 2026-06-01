import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Harness, HarnessEvent, HarnessStatus } from "../../harness"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const TimelineResponse = z
  .object({
    data: HarnessEvent.array(),
  })
  .meta({ ref: "HarnessTimelineResponse" })

export const HarnessRoutes = lazy(() =>
  new Hono()
    .get(
      "/status",
      describeRoute({
        summary: "Harness status",
        description: "Returns the current RAILWISE Harness runtime status.",
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
          ...errors(500),
        },
      }),
      async (c) => c.json(await Harness.status()),
    )
    .get(
      "/session/:sessionID/timeline",
      describeRoute({
        summary: "Harness timeline",
        description: "Returns visible Harness events for a session.",
        operationId: "harness.session.timeline",
        responses: {
          200: {
            description: "Harness timeline",
            content: {
              "application/json": {
                schema: resolver(TimelineResponse),
              },
            },
          },
          ...errors(400, 500),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => c.json({ data: await Harness.timeline(c.req.valid("param")) }),
    )
    .post(
      "/session/:sessionID/permission/:permissionID",
      describeRoute({
        summary: "Resolve Harness permission",
        description: "Approves or rejects a pending Harness permission request.",
        operationId: "harness.session.permission.resolve",
        responses: {
          200: {
            description: "Permission resolution accepted",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 500),
        },
      }),
      validator("param", z.object({ sessionID: z.string(), permissionID: z.string() })),
      async (c) => c.json(await Harness.resolvePermission(c.req.valid("param"))),
    ),
)
