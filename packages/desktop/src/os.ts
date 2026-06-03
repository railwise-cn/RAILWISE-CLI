import { type as ostype } from "@tauri-apps/plugin-os"

export function os() {
  const type = (() => {
    try {
      return ostype()
    } catch {
      return undefined
    }
  })()
  if (type === "macos" || type === "windows") return type
  return undefined
}
