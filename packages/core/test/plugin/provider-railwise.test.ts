import { describe, expect } from "bun:test"
import { DateTime, Effect, Layer, Option } from "effect"
import { Catalog } from "@railwise/core/catalog"
import { Location } from "@railwise/core/location"
import { ModelV2 } from "@railwise/core/model"
import { PluginV2 } from "@railwise/core/plugin"
import { OpencodePlugin } from "@railwise/core/plugin/provider/railwise"
import { Policy } from "@railwise/core/policy"
import { ProviderV2 } from "@railwise/core/provider"
import { AbsolutePath } from "@railwise/core/schema"
import { location } from "../fixture/location"
import { it, model, provider, withEnv } from "./provider-helper"

const cost = (input: number, output = 0) => [{ input, output, cache: { read: 0, write: 0 } }]
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("test") })),
)

describe("OpencodePlugin", () => {
  it.effect("uses a public key and disables paid models without credentials", () =>
    withEnv({ RAILWISE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("railwise")
          catalog.provider.update(item.id, () => {})
          const paid = model("railwise", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.railwise)).options.aisdk.provider.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.railwise, ModelV2.ID.make("paid"))).enabled).toBe(false)
      }),
    ),
  )

  it.effect("keeps free models without credentials", () =>
    withEnv({ RAILWISE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("railwise")
          catalog.provider.update(item.id, () => {})
          const free = model("railwise", "free", { cost: cost(0) })
          catalog.model.update(item.id, free.id, (draft) => {
            draft.cost = [...free.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.railwise)).options.aisdk.provider.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.railwise, ModelV2.ID.make("free"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("treats output-only cost as free without credentials", () =>
    withEnv({ RAILWISE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("railwise")
          catalog.provider.update(item.id, () => {})
          const outputOnly = model("railwise", "output-only", { cost: cost(0, 1) })
          catalog.model.update(item.id, outputOnly.id, (draft) => {
            draft.cost = [...outputOnly.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.railwise)).options.aisdk.provider.apiKey).toBe("public")
        expect((yield* catalog.model.get(ProviderV2.ID.railwise, ModelV2.ID.make("output-only"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses RAILWISE_API_KEY as credentials", () =>
    withEnv({ RAILWISE_API_KEY: "secret" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("railwise")
          catalog.provider.update(item.id, () => {})
          const paid = model("railwise", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.railwise)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.railwise, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses configured provider env vars as credentials", () =>
    withEnv({ RAILWISE_API_KEY: undefined, CUSTOM_RAILWISE_API_KEY: "secret" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("railwise", { env: ["CUSTOM_RAILWISE_API_KEY"] })
          catalog.provider.update(item.id, (draft) => {
            draft.env = [...item.env]
          })
          const paid = model("railwise", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.railwise)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.railwise, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses configured apiKey as credentials", () =>
    withEnv({ RAILWISE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("railwise", {
            options: {
              headers: {},
              body: {},
              aisdk: {
                provider: { apiKey: "configured" },
                request: {},
              },
            },
          })
          catalog.provider.update(item.id, (draft) => {
            draft.options = item.options
          })
          const paid = model("railwise", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.railwise)).options.aisdk.provider.apiKey).toBe("configured")
        expect((yield* catalog.model.get(ProviderV2.ID.railwise, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("uses auth-enabled providers as credentials", () =>
    withEnv({ RAILWISE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("railwise", { enabled: { via: "account", service: "railwise" } })
          catalog.provider.update(item.id, (draft) => {
            draft.enabled = item.enabled
          })
          const paid = model("railwise", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.railwise)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.railwise, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("ignores non-railwise providers and models", () =>
    withEnv({ RAILWISE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(OpencodePlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("openai")
          catalog.provider.update(item.id, () => {})
          const paid = model("openai", "paid", { cost: cost(1) })
          catalog.model.update(item.id, paid.id, (draft) => {
            draft.cost = [...paid.cost]
          })
        })
        expect((yield* catalog.provider.get(ProviderV2.ID.openai)).options.aisdk.provider.apiKey).toBeUndefined()
        expect((yield* catalog.model.get(ProviderV2.ID.openai, ModelV2.ID.make("paid"))).enabled).toBe(true)
      }),
    ),
  )

  it.effect("prefers gpt-5-nano as the railwise small model", () =>
    Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const providerID = ProviderV2.ID.railwise

      const transform = yield* catalog.transform()
      yield* transform((catalog) => {
        catalog.provider.update(providerID, () => {})
        catalog.model.update(providerID, ModelV2.ID.make("cheap-mini"), (model) => {
          model.capabilities.input = ["text"]
          model.capabilities.output = ["text"]
          model.cost = [...cost(1, 1)]
          model.time.released = DateTime.makeUnsafe(Date.now())
        })
        catalog.model.update(providerID, ModelV2.ID.make("gpt-5-nano"), (model) => {
          model.capabilities.input = ["text"]
          model.capabilities.output = ["text"]
          model.cost = [...cost(10, 10)]
          model.time.released = DateTime.makeUnsafe(Date.now())
        })
      })

      const selected = yield* catalog.model.small(providerID)

      expect(Option.getOrUndefined(selected)?.id).toBe(ModelV2.ID.make("gpt-5-nano"))
    }).pipe(
      Effect.provide(Catalog.defaultLayer.pipe(Layer.provide(Policy.defaultLayer), Layer.provide(locationLayer))),
    ),
  )
})
