import { run as runTui, type TuiInput } from "@railwise/tui"
import { Global } from "@railwise/core/global"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(Global.defaultLayer))
}
