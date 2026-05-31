import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { HarnessEvent, HarnessStatus } from "../../harness"
import { Marketplace } from "../../marketplace"
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
      async (c) =>
        c.json(
          HarnessStatus.parse({
            mode: "safe",
            capabilityCount: Marketplace.list().filter((item) => item.enabled).length,
            pendingPermissionCount: 0,
            runningToolCount: 0,
          }),
        ),
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
      async (c) => c.json({ data: [] }),
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
      async (c) => c.json(true),
    ),
)
