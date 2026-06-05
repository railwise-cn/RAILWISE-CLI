#!/usr/bin/env bun

import path from "node:path"

type Step = {
  name: string
  cwd: string
  args: string[]
}

type PackageJson = {
  version?: string
}

type TauriConfig = {
  version?: string
  productName?: string
  identifier?: string
  mainBinaryName?: string
}

const root = path.resolve(import.meta.dir, "..")
const args = Bun.argv.slice(2)
const full = args.includes("--full")
const live = args.includes("--live") || full
const checks: { name: string; passed: boolean; detail: string }[] = []
const file = (...parts: string[]) => path.join(root, ...parts)
const read = async (...parts: string[]) => Bun.file(file(...parts)).text()
const json = async <T>(...parts: string[]) => (await Bun.file(file(...parts)).json()) as T
const has = (text: string, values: string[]) => values.every((value) => text.includes(value))
const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })

const desktop = await json<PackageJson>("packages/desktop/package.json")
const tauri = await json<TauriConfig>("packages/desktop/src-tauri/tauri.conf.json")
const cargo = await read("packages/desktop/src-tauri/Cargo.toml")
const changelog = await read("CHANGELOG.md")
const cadence = await read("docs/dev/05-release-cadence.md")
const update = await read("docs/admin/04-update-server.md")
const betaQa = await read("docs/dev/12-desktop-harness-marketplace-beta.md")
const betaManual = await read("docs/dev/13-desktop-beta-manual-check.md")
const wrangler = await read("workers/update-server/wrangler.toml")
const version = desktop.version ?? ""
const tag = `desktop/v${version}`
const old = [
  ["open", "code"].join(""),
  ["anomaly", "co"].join(""),
  ["anomaly", ".co"].join(""),
  ["anomaly", "-labs"].join(""),
]
const oldHits = old.filter((item) => changelog.toLowerCase().includes(item))
const status = (name: string) => betaManual.match(new RegExp(`- ${name}=([^\\n]+)`))?.[1]?.trim()
const steps: Step[] = [
  {
    name: "desktop static acceptance",
    cwd: root,
    args: ["bun", "run", "desktop:verify", ...args],
  },
]

check("desktop version format", /^\d+\.\d+\.\d+$/.test(version), version || "missing")
check(
  "desktop version consistency",
  tauri.version === version && cargo.includes(`version = "${version}"`),
  `package ${version}, tauri ${tauri.version ?? "missing"}, cargo ${version}`,
)
check(
  "desktop product identity",
  tauri.productName === "睿威智测 RAILWISE" &&
    tauri.identifier === "ai.railwise.desktop.dev" &&
    tauri.mainBinaryName === "railwise",
  `${tauri.productName ?? "missing"} / ${tauri.identifier ?? "missing"} / ${tauri.mainBinaryName ?? "missing"}`,
)
check(
  "release cadence",
  has(cadence, [
    tag,
    "10%",
    "30%",
    "100%",
    "bun run desktop:verify",
    "Windows 内测安装包验收",
    "cd workers/update-server && bun ./verify.ts",
    "12-desktop-harness-marketplace-beta.md",
  ]),
  `${tag} rollout and preflight commands`,
)
check(
  "update server deploy config",
  has(wrangler, [
    'name = "railwise-desktop-update-server"',
    'main = "index.js"',
    'pattern = "updates.railwise.cn/desktop/*"',
    'binding = "UPDATE_KV"',
  ]),
  "wrangler route and KV binding configured",
)
check(
  "update server acceptance docs",
  has(update, ["GET /desktop/{{target}}/{{current_version}}", "bun ./verify.ts", "bun run desktop:verify"]),
  "admin update-server doc includes local and integrated verification",
)
check(
  "changelog release entry",
  has(changelog, [`## v${version}`, "Desktop 中文化首版", "M6", "M7"]) && !changelog.includes("待 review"),
  `CHANGELOG v${version}`,
)
check(
  "desktop beta QA gate",
  has(betaQa, [
    "Desktop Harness Marketplace Beta QA",
    "自动验收",
    "人工验收",
    "Beta 阻断条件",
    "Linux：不做 Desktop 安装包",
    "script/verify-desktop-windows-internal.ts",
    "browserType.launch",
  ]),
  "beta QA checklist is present for release gating",
)
check(
  "desktop manual launch acceptance",
  status("terminal_smoke") === "passed" &&
    status("finder_launch") === "passed" &&
    status("manual_checklist") === "passed" &&
    status("beta_decision") === "passed",
  `terminal=${status("terminal_smoke") ?? "missing"}, finder=${status("finder_launch") ?? "missing"}, manual=${status("manual_checklist") ?? "missing"}, beta=${status("beta_decision") ?? "missing"}`,
)
check(
  "changelog brand residue",
  oldHits.length === 0,
  oldHits.length === 0 ? "no old brand terms in changelog" : `found: ${oldHits.join(", ")}`,
)

for (const step of steps) {
  console.log(`\n==> ${step.name}`)
  const result = Bun.spawnSync(step.args, {
    cwd: step.cwd,
    env: Bun.env,
    stdout: "inherit",
    stderr: "inherit",
  })
  check(step.name, result.exitCode === 0, `exit ${result.exitCode}`)
}

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} GA readiness check(s) failed.`)
  process.exit(1)
}

if (full) {
  console.log("\nGA full readiness passed.")
} else if (live) {
  console.log("\nGA live readiness passed. Run `bun run desktop:verify:ga -- --full` for the 30-minute live gate.")
} else {
  console.log("\nGA static readiness passed. Run `bun run desktop:verify:ga -- --full` for the 30-minute live gate.")
}
