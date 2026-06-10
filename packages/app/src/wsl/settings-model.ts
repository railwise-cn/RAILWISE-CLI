import type { WslOpencodeCheck, WslServerRuntime } from "./types"

export const wslRuntimeRetryable = (runtime: WslServerRuntime) =>
  runtime.kind === "failed" || runtime.kind === "stopped"

export async function enterWslOpencodeStep(
  distro: string,
  probe: (distro: string) => Promise<unknown>,
  select: (step: "railwise") => void,
) {
  await probe(distro)
  select("railwise")
}

export function wslOpencodeAction(check?: WslOpencodeCheck) {
  if (!check) return
  if (!check.resolvedPath) return "Install RAILWISE"
  if (check.matchesDesktop === false) return "Update RAILWISE"
}
