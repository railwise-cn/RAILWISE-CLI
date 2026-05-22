import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Harness, HarnessEvent, HarnessStatus } from "../../harness"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const SessionParam = z.object({
  sessionID: z.string(),
})

const PermissionParam = SessionParam.extend({
  permissionID: z.string(),
})

const PermissionBody = z.object({
  action: z.enum(["allow", "deny"]),
})

export const HarnessRoutes = lazy(() =>
  new Hono()
    .get(
      "/status",
      describeRoute({
        summary: "Get Harness status",
        description: "Return the current RAILWISE Harness runtime status for the active workspace.",
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
        },
      }),
      (c) => c.json(Harness.status()),
    )
    .get(
      "/session/:sessionID/timeline",
      describeRoute({
        summary: "Get Harness session timeline",
        description: "Return Harness planning, permission, tool, and artifact events for a session.",
        operationId: "harness.timeline",
        responses: {
          200: {
            description: "Harness timeline",
            content: {
              "application/json": {
                schema: resolver(HarnessEvent.array()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", SessionParam),
      (c) => c.json(Harness.timeline(c.req.valid("param").sessionID)),
    )
    .post(
      "/session/:sessionID/permission/:permissionID",
      describeRoute({
        summary: "Resolve Harness permission",
        description: "Record a user decision for a Harness permission request.",
        operationId: "harness.permission.resolve",
        responses: {
          200: {
            description: "Permission decision event",
            content: {
              "application/json": {
                schema: resolver(HarnessEvent),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("param", PermissionParam),
      validator("json", PermissionBody),
      (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const event = Harness.record({
          id: `${param.permissionID}:${Date.now()}`,
          sessionID: param.sessionID,
          type: "permission.resolved",
          title: body.action === "allow" ? "已允许权限请求" : "已拒绝权限请求",
          detail: param.permissionID,
          createdAt: Date.now(),
          risk: body.action === "allow" ? "medium" : "low",
        })
        return c.json(event)
      },
    ),
)
