import { createMemo } from "solid-js"
import { useSync } from "../context/sync"

export function useConnected() {
  const sync = useSync()
  return createMemo(() =>
    sync.data.provider.some((x) => x.id !== "railwise" || Object.values(x.models).some((y) => y.cost?.input !== 0)),
  )
}
