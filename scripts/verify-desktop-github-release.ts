#!/usr/bin/env bun

import { $ } from "bun"
import path from "node:path"

type Run = {
  databaseId: number
  status: string
  conclusion: string | null
  headBranch: string | null
  headSha: string
  displayTitle: string
  url: string
}

type Release = {
  tagName: string
  name: string
  isDraft: boolean
  isPrerelease: boolean
  targetCommitish: string
  assets: { name: string; size: number }[]
  url: string
}

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const flag = (name: string) => args.includes(name)

const run = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const result = await $(strings, ...values)
    .quiet()
    .nothrow()
  if (result.exitCode === 0) return result.stdout.toString().trim()
  throw new Error((result.stderr.toString() || result.stdout.toString()).trim())
}

const json = async <T>(strings: TemplateStringsArray, ...values: unknown[]) =>
  JSON.parse(await run(strings, ...values)) as T

async function main() {
  const repo = arg("--repo", "railwise-cn/RAILWISE-CLI")!
  const tag = arg("--tag", "desktop/v1.3.0-beta.17")!
  const sha = arg("--sha")
  const download = flag("--download")
  const published = flag("--published")
  const dir = arg("--download-dir", path.join("/private", "tmp", "railwise-official-release"))
  const workflow = "desktop-release.yml"
  const expect = [
    "railwise-desktop-darwin-aarch64.app.tar.gz",
    "railwise-desktop-darwin-aarch64.app.tar.gz.sig",
    "railwise-desktop-darwin-aarch64.dmg",
    "railwise-desktop-darwin-x64.app.tar.gz",
    "railwise-desktop-darwin-x64.app.tar.gz.sig",
    "railwise-desktop-darwin-x64.dmg",
    "SHA256SUMS.txt",
  ]

  const lines = (sha ? "" : await run`git ls-remote origin ${`refs/tags/${tag}`} ${`refs/tags/${tag}^{}`}`)
    .trim()
    .split("\n")
    .filter(Boolean)
  const ref = sha ?? lines.map((line) => line.split(/\s+/)).find((item) => item[1] === `refs/tags/${tag}^{}`)?.[0]

  if (!ref) throw new Error(`Unable to resolve ${tag} from origin`)

  const runs = await json<
    Run[]
  >`gh run list --repo ${repo} --workflow ${workflow} --limit 30 --json databaseId,status,conclusion,headBranch,headSha,displayTitle,url`
  const hit =
    runs.find((item) => item.headSha === ref && item.headBranch === tag) ?? runs.find((item) => item.headSha === ref)
  if (!hit) throw new Error(`No Desktop Release workflow run found for ${tag} (${ref})`)

  const release =
    await json<Release>`gh release view ${tag} --repo ${repo} --json tagName,name,isDraft,isPrerelease,targetCommitish,assets,url`
  const names = release.assets.map((asset) => asset.name).sort()
  const missing = expect.filter((name) => !names.includes(name))
  const extra = names.filter((name) => !expect.includes(name))
  const empty = release.assets.filter((asset) => asset.size <= 0).map((asset) => asset.name)

  const checks = [
    ["tag resolves", ref.length === 40, ref],
    ["workflow run exists", Boolean(hit), hit.url],
    ["workflow run completed", hit.status === "completed", `${hit.status} / ${hit.conclusion ?? "none"}`],
    ["workflow run succeeded", hit.conclusion === "success", `${hit.status} / ${hit.conclusion ?? "none"}`],
    ["release tag", release.tagName === tag, release.tagName],
    ["release target", release.targetCommitish === ref, release.targetCommitish],
    [
      "release visibility",
      published ? !release.isDraft && release.isPrerelease : release.isDraft,
      published
        ? `draft=${release.isDraft} / prerelease=${release.isPrerelease} / ${release.url}`
        : `draft=${release.isDraft} / ${release.url}`,
    ],
    ["release asset count", names.length === expect.length, names.join(", ")],
    ["release expected assets", missing.length === 0, missing.join(", ") || "all present"],
    ["release has no extra assets", extra.length === 0, extra.join(", ") || "none"],
    ["release assets non-empty", empty.length === 0, empty.join(", ") || "all non-empty"],
  ] as const

  for (const item of checks) console.log(`${item[1] ? "[ok]" : "[fail]"} ${item[0]}: ${item[2]}`)

  const failed = checks.filter((item) => !item[1])
  if (failed.length > 0) {
    console.error(`\n${failed.length} GitHub Desktop release check(s) failed for ${tag}.`)
    process.exit(1)
  }

  if (download) {
    await run`mkdir -p ${dir}`
    await run`gh release download ${tag} --repo ${repo} --pattern railwise-desktop-darwin-aarch64.dmg --pattern SHA256SUMS.txt --dir ${dir} --clobber`
    console.log(`Downloaded Apple Silicon DMG to ${dir}`)
  }

  console.log(`\nGitHub Desktop release verification passed for ${tag}.`)
}

await main().catch((err) => {
  console.error(
    [
      "GitHub Desktop release verification failed.",
      err instanceof Error ? err.message : String(err),
      "If this is an api.github.com or ssh.github.com network error, rerun from a network-enabled shell after GitHub access recovers.",
    ].join("\n"),
  )
  process.exit(1)
})
