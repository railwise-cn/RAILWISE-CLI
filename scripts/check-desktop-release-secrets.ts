#!/usr/bin/env bun

const args = Bun.argv.slice(2)
const has = (name: string) => args.includes(name)
const value = (name: string) => {
  const i = args.indexOf(name)
  if (i < 0) return
  return args[i + 1]
}

const repo = value("--repo") ?? Bun.env.GITHUB_REPOSITORY ?? "railwise-cn/RAILWISE-CLI"
const groups = [
  {
    name: "shared",
    secrets: ["TAURI_SIGNING_PRIVATE_KEY", "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"],
  },
  {
    name: "macOS",
    secrets: [
      "APPLE_CERTIFICATE",
      "APPLE_CERTIFICATE_PASSWORD",
      "APPLE_KEYCHAIN_PASSWORD",
      "APPLE_ID",
      "APPLE_ID_PASSWORD",
      "APPLE_TEAM_ID",
      "APPLE_SIGNING_IDENTITY",
    ],
  },
  {
    name: "Windows",
    secrets: ["SIGNPATH_API_TOKEN", "SIGNPATH_ORG_ID"],
  },
]

if (has("--help") || has("-h")) {
  console.log(`
Usage: bun ./scripts/check-desktop-release-secrets.ts [--repo owner/name]

Checks GitHub secret names required by the Desktop Release workflow.
The command only reads secret names; it never reads secret values.
`)
  process.exit(0)
}

const result = Bun.spawnSync(["gh", "secret", "list", "--repo", repo], {
  stdout: "pipe",
  stderr: "pipe",
})

if (result.exitCode !== 0) {
  console.error(new TextDecoder().decode(result.stderr).trim() || `failed to list secrets for ${repo}`)
  process.exit(result.exitCode)
}

const configured = new Set(
  new TextDecoder()
    .decode(result.stdout)
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean),
)

const missing = groups.flatMap((group) => {
  const items = group.secrets.filter((secret) => !configured.has(secret))
  console.log(
    `${items.length === 0 ? "[ok]" : "[fail]"} ${group.name}: ${items.length === 0 ? "configured" : items.join(", ")}`,
  )
  return items
})

if (missing.length > 0) {
  console.error(`\n${missing.length} required Desktop Release secret(s) are missing from ${repo}.`)
  process.exit(1)
}

console.log(`\nDesktop Release secrets are configured for ${repo}.`)
