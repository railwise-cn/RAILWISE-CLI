import { createContext, onCleanup, onMount, useContext, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { useGlobalSDK } from "@/context/global-sdk"

type RawEvent = { type: string; properties: Record<string, unknown> }
type Value = { lastEvent: RawEvent | null }

const EventsContext = createContext<Value>({ lastEvent: null })

export function EventsProvider(props: ParentProps) {
  const global = useGlobalSDK()
  const [state, setState] = createStore<Value>({ lastEvent: null })

  onMount(() => {
    const stop = global.event.listen((event) => {
      const payload = event.details as RawEvent
      if (payload.type === "server.heartbeat") return
      setState("lastEvent", payload)
    })
    onCleanup(stop)
  })

  return <EventsContext.Provider value={state}>{props.children}</EventsContext.Provider>
}

export function useEvents() {
  return useContext(EventsContext)
}
