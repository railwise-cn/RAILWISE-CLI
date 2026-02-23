import { $, semver } from "bun"
import path from "path"
// ============================================================
// RAILWISE Distribution Config — 发布前只需修改这里
// ============================================================
// TODO: 创建 GitHub repo 后，把下面的占位符替换为你的实际值
const GITHUB_OWNER = "YOUR_GITHUB_ORG"    // e.g. "railwise-ai"
const GITHUB_REPO = "railwise"             // GitHub 仓库名
const NPM_PACKAGE = "railwise-ai"          // npm 发布包名
const DOCKER_IMAGE = `ghcr.io/${GITHUB_OWNER}/${GITHUB_REPO}`
const HOMEBREW_TAP = `${GITHUB_OWNER}/homebrew-tap`
// ============================================================

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  RAILWISE_CHANNEL: process.env["RAILWISE_CHANNEL"],
  RAILWISE_BUMP: process.env["RAILWISE_BUMP"],
  RAILWISE_VERSION: process.env["RAILWISE_VERSION"],
  RAILWISE_RELEASE: process.env["RAILWISE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.RAILWISE_CHANNEL) return env.RAILWISE_CHANNEL
  if (env.RAILWISE_BUMP) return "latest"
  if (env.RAILWISE_VERSION && !env.RAILWISE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.RAILWISE_VERSION) return env.RAILWISE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`)
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.RAILWISE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const team = [
  "actions-user",
  // TODO: 替换为你团队的 GitHub 用户名
  "railwise-bot",
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.RAILWISE_RELEASE
  },
  get team() {
    return team
  },
  get github() {
    return { owner: GITHUB_OWNER, repo: GITHUB_REPO, full: `${GITHUB_OWNER}/${GITHUB_REPO}` }
  },
  get npm() {
    return NPM_PACKAGE
  },
  get docker() {
    return DOCKER_IMAGE
  },
  get homebrew() {
    return HOMEBREW_TAP
  },
}
console.log(`railwise script`, JSON.stringify(Script, null, 2))
