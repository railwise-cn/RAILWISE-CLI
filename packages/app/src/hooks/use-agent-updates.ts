import { createEffect, onCleanup } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"

export function useAgentUpdates(refresh: (name: string) => void) {
  const global = useGlobalSDK()

  createEffect(() => {
    const off = global.event.on("global", (event) => {
      const payload = event as { type: string; properties?: { name?: unknown } }
      if (payload.type !== "agent.updated") return
      if (typeof payload.properties?.name !== "string") return
      refresh(payload.properties.name)
    })
    onCleanup(off)
  })
}
