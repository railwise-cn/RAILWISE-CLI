#!/usr/bin/env bun

import { $ } from "bun"
import os from "node:os"
import path from "node:path"

type State = {
  upstream: {
    remote: string
    url: string
  }
  reviewed: {
    tag: string
    commit: string
    date: string
  }
  target: {
    tag: string
    commit: string
    status: "pending" | "in_progress" | "reviewed"
  }
  history: Array<{
    tag: string
    commit: string
    date: string
    report: string
  }>
}

const file = "scripts/upstream-state.json"
const state = (await Bun.file(file).json()) as State
const args = Bun.argv.slice(2)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const flag = (name: string) => args.includes(name)
const base = arg("--from") ?? state.reviewed.tag
const target = arg("--to") ?? state.target.tag
const write = flag("--write")
const record = flag("--record")
const dry = flag("--dry-run")
const api = flag("--api")
const output = arg("--out") ?? `docs/dev/opencode-${target.replace(/^v/, "v")}-sync-audit.md`

if (record && !write)
  throw new Error("--record requires --write so the reviewed report is committed with the state change")

async function ensure() {
  const remote = await $`git remote get-url ${state.upstream.remote}`.quiet().nothrow()
  if (remote.exitCode !== 0) {
    await $`git remote add ${state.upstream.remote} ${state.upstream.url}`
    return
  }
  if (remote.stdout.toString().trim() === state.upstream.url) return
  await $`git remote set-url ${state.upstream.remote} ${state.upstream.url}`
}

const repo = new URL(state.upstream.url).pathname.replace(/^\//, "").replace(/\.git$/, "")

async function tree(commit: string) {
  const file = path.join(os.tmpdir(), `railwise-opencode-${commit}.json`)
  if (await Bun.file(file).exists()) return file
  const result = await $`gh api --method GET ${`repos/${repo}/git/trees/${commit}`} -f recursive=1`.quiet().nothrow()
  if (result.exitCode !== 0)
    throw new Error(`Could not fetch upstream tree ${commit} through GitHub API:\n${result.stderr}`)
  await Bun.write(file, result.stdout)
  return file
}

async function resolve(tag: string) {
  const known = [state.reviewed, state.target, ...state.history].find((item) => item.tag === tag)
  if (known) return known.commit
  const result = await $`gh api ${`repos/${repo}/git/ref/tags/${tag}`}`.quiet().nothrow()
  if (result.exitCode !== 0)
    throw new Error(`Could not resolve upstream tag ${tag} through GitHub API:\n${result.stderr}`)
  const ref = JSON.parse(result.stdout.toString()) as { object: { sha: string; type: "commit" | "tag" } }
  if (ref.object.type === "commit") return ref.object.sha
  const annotated = await $`gh api ${`repos/${repo}/git/tags/${ref.object.sha}`}`.quiet().nothrow()
  if (annotated.exitCode !== 0) throw new Error(`Could not resolve annotated upstream tag ${tag}:\n${annotated.stderr}`)
  return (JSON.parse(annotated.stdout.toString()) as { object: { sha: string } }).object.sha
}

async function fetch(tag: string) {
  const ref = `refs/railwise-sync/${tag}`
  const local = await $`git rev-parse --verify ${ref}`.quiet().nothrow()
  if (local.exitCode === 0) return { ref, commit: local.stdout.toString().trim() }
  if (!api) {
    const result =
      await $`git fetch --no-tags --depth=1 --filter=blob:none ${state.upstream.remote} +refs/tags/${tag}:${ref}`
        .quiet()
        .nothrow()
    if (result.exitCode === 0) return { ref, commit: (await $`git rev-parse ${ref}`.text()).trim() }
    console.warn(`Git fetch failed for ${tag}; falling back to GitHub API tree audit.`)
  }
  const commit = await resolve(tag)
  return { ref: tag, commit, tree: await tree(commit) }
}

if (dry) {
  console.log(
    [
      `Would audit ${base}..${target} from ${state.upstream.url}`,
      api
        ? "Would use GitHub API trees without switching branches"
        : "Would fetch tags into refs/railwise-sync without switching branches, with an API fallback",
      write ? `Would write ${output}` : "Would print the report without changing tracked files",
      record ? `Would record ${target} as reviewed` : "Would leave reviewed state unchanged",
    ].join("\n"),
  )
  process.exit(0)
}

await ensure()
const from = await fetch(base)
const to = await fetch(target)
const report =
  from.tree || to.tree
    ? await $`bun scripts/opencode-sync-audit.ts ${base} ${target} --base-tree ${from.tree ?? (await tree(from.commit))} --target-tree ${to.tree ?? (await tree(to.commit))}`.text()
    : await $`bun scripts/opencode-sync-audit.ts ${from.ref} ${to.ref} --base-label ${base} --target-label ${target}`.text()

if (!write) {
  console.log(report)
  process.exit(0)
}

await Bun.write(output, report)
const format = await $`bun x prettier --write ${output}`.quiet().nothrow()
if (format.exitCode !== 0) console.warn(`Could not format ${output}:\n${format.stderr}`)
console.log(`Wrote ${output}`)

if (!record) process.exit(0)

const commit = to.commit
const date = new Date().toISOString().slice(0, 10)
const next = {
  ...state,
  reviewed: { tag: target, commit, date },
  target: { tag: target, commit, status: "reviewed" as const },
  history: [
    ...state.history.filter((item) => item.tag !== target),
    { tag: target, commit, date, report: path.relative(process.cwd(), output) },
  ],
}
await Bun.write(file, `${JSON.stringify(next, null, 2)}\n`)
console.log(`Recorded ${target} (${commit}) as reviewed in ${file}`)
