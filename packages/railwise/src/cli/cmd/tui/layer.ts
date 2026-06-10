import { Layer } from "effect"
import { TuiConfig } from "./config/tui"
import { Npm } from "@railwise/core/npm"
import { Observability } from "@railwise/core/effect/observability"

export const CliLayer = Observability.layer.pipe(Layer.merge(TuiConfig.layer), Layer.provide(Npm.defaultLayer))
