#!/usr/bin/env bun

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { AccountV2 } from "@railwise/core/account"
import { AgentV2 } from "@railwise/core/agent"
import { Catalog } from "@railwise/core/catalog"
import { Config } from "@railwise/core/config"
import { EventV2 } from "@railwise/core/event"
import { Location } from "@railwise/core/location"
import { Npm } from "@railwise/core/npm"
import { PluginV2 } from "@railwise/core/plugin"
import { PluginBoot } from "@railwise/core/plugin/boot"
import { Policy } from "@railwise/core/policy"
import { AbsolutePath } from "@railwise/core/schema"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { DebugCommand } from "./debug"

const cli = Command.make("railwise", {}, () => Effect.void).pipe(
  Command.withDescription("RAILWISE command line interface"),
  Command.withSubcommands([DebugCommand]),
)

const locationLayer = Location.defaultLayer({
  directory: AbsolutePath.make(process.cwd()),
})

const policyLayer = Policy.defaultLayer.pipe(Layer.provideMerge(locationLayer))
const pluginLayer = PluginV2.defaultLayer
const eventLayer = EventV2.defaultLayer

const layer = PluginBoot.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      NodeServices.layer,
      Catalog.layer.pipe(Layer.provideMerge(Layer.mergeAll(eventLayer, pluginLayer, policyLayer))),
      eventLayer,
      pluginLayer,
      AccountV2.defaultLayer,
      AgentV2.defaultLayer,
      Config.defaultLayer.pipe(Layer.provideMerge(policyLayer)),
      Npm.defaultLayer,
    ),
  ),
)

Command.run(cli, { version: "local" }).pipe(Effect.provide(layer), Effect.scoped, NodeRuntime.runMain)
