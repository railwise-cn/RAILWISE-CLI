import { drop, isEnabled, take } from "./store"

const INTERVAL = 5 * 60 * 1000
const endpoint = import.meta.env.VITE_RAILWISE_TELEMETRY_ENDPOINT as string | undefined

let timer: ReturnType<typeof setInterval> | undefined

export async function flush() {
  if (!(await isEnabled())) return { sent: false, count: 0 }
  if (!endpoint) return { sent: false, count: 0 }

  const events = await take()
  if (events.length === 0) return { sent: true, count: 0 }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
  }).catch(() => null)

  if (!res?.ok) return { sent: false, count: events.length }
  await drop(events.map((event) => event.id))
  return { sent: true, count: events.length }
}

export function startBatcher() {
  if (timer) return
  timer = setInterval(() => void flush(), INTERVAL)
}
