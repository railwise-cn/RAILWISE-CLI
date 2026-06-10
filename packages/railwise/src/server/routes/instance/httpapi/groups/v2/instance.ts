import { Catalog } from "@railwise/core/catalog"
import { Instance } from "@railwise/core/instance"
import { InstanceServiceMap } from "@railwise/core/instance-layer"
import { PluginBoot } from "@railwise/core/plugin/boot"
import { Effect, Layer, Schema } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiMiddleware, OpenApi } from "effect/unstable/httpapi"

export const InstanceQuery = Schema.Struct({
  instance: Schema.optional(
    Schema.Struct({
      directory: Schema.optional(Schema.String),
      workspace: Schema.optional(Schema.String),
    }),
  ),
}).annotate({ identifier: "V2InstanceQuery" })

export const instanceQueryOpenApi = OpenApi.annotations({
  transform: (operation) => {
    const parameters = operation.parameters
    if (!Array.isArray(parameters)) return operation
    return {
      ...operation,
      parameters: parameters.map((parameter) =>
        parameter?.name === "instance" && parameter?.in === "query"
          ? { ...parameter, style: "deepObject", explode: true }
          : parameter,
      ),
    }
  },
})

export class V2InstanceMiddleware extends HttpApiMiddleware.Service<
  V2InstanceMiddleware,
  {
    provides: Catalog.Service | PluginBoot.Service
  }
>()("@railwise/ExperimentalHttpApiV2Instance") {}

function ref(request: HttpServerRequest.HttpServerRequest): Instance.Ref {
  const query = new URL(request.url, "http://localhost").searchParams
  return {
    directory: query.get("instance[directory]") || request.headers["x-railwise-directory"] || process.cwd(),
    workspaceID: query.get("instance[workspace]") || request.headers["x-railwise-workspace"],
  }
}

export const layer = Layer.effect(
  V2InstanceMiddleware,
  Effect.gen(function* () {
    const instances = yield* InstanceServiceMap
    return V2InstanceMiddleware.of((effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        return yield* effect.pipe(Effect.provide(instances.get(ref(request))))
      }),
    )
  }),
).pipe(Layer.provide(InstanceServiceMap.layer))
