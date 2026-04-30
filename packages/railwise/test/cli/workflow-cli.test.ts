import { expect, test } from "bun:test"
import { mkdir } from "fs/promises"
import path from "path"
import { tmpdir } from "../fixture/fixture"

const root = path.join(import.meta.dir, "../..")

function env(dir: string) {
  const base = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
  return {
    ...base,
    XDG_DATA_HOME: path.join(dir, "share"),
    XDG_CACHE_HOME: path.join(dir, "cache"),
    XDG_CONFIG_HOME: path.join(dir, "config"),
    XDG_STATE_HOME: path.join(dir, "state"),
    RAILWISE_TEST_HOME: path.join(dir, "home"),
    RAILWISE_MODELS_PATH: path.join(root, "test", "tool", "fixtures", "models-api.json"),
  }
}

async function exec(input: { args: string[]; env: Record<string, string> }) {
  const proc = Bun.spawn({
    cmd: [process.execPath, ...input.args],
    cwd: root,
    env: input.env,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, code }
}

const seed = `
import path from "node:path"
import { mkdir } from "node:fs/promises"

const project = process.argv[1]
const { Log } = await import("./src/util/log")
Log.init({ print: false })
const { Identifier } = await import("./src/id/id")
const { Instance } = await import("./src/project/instance")
const { Session } = await import("./src/session")

await Instance.provide({ directory: project, fn: async () => {
  const session = await Session.create({ title: "CLI process export" })
  const md = "wiki/changes/format-coverage-2026-04-30.md"
  const json = "wiki/changes/format-coverage-2026-04-30.json"
  const root = path.join(project, ".railwise", "norm-library")
  await mkdir(path.join(root, "wiki", "changes"), { recursive: true })
  await Bun.write(path.join(root, md), "# Format coverage\\n")
  await Bun.write(path.join(root, json), "{\\"ready\\":true}\\n")
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "user",
    sessionID: session.id,
    agent: "chief_manager",
    model: { providerID: "test", modelID: "test" },
    time: { created: Date.now() },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: user.id,
    sessionID: session.id,
    type: "text",
    text: \`Artifacts:\\n- Format coverage Markdown: \${md}\\n- Format coverage JSON: \${json}\`,
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "assistant",
    sessionID: session.id,
    mode: "build",
    agent: "chief_manager",
    path: { cwd: ".", root: "." },
    cost: 0,
    tokens: { output: 0, input: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: "test",
    providerID: "test",
    parentID: user.id,
    time: { created: Date.now(), completed: Date.now() },
    finish: "end_turn",
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: assistant.id,
    sessionID: session.id,
    type: "text",
    text: [
      "# CPIII delivery",
      "",
      "## 附件引用",
      \`- 格式兼容性质检报告 Markdown: \${md}\`,
      \`- 格式兼容性质检报告 JSON: \${json}\`,
      "",
      "## 规范引用",
      "- wiki_page_path: wiki/clauses/cpiii-precision.md",
      "- raw_source_md: raw/tb10601.md",
      "- norm_clause_id: TB10601-3.1",
      "",
      "## 工具结果摘要",
      "- 格式样本 6/6 可用，warning 2 条。",
      "- sigma0、残差、自由网、粗差、稳健、方差分量、条件平差均已汇总。",
    ].join("\\n"),
  })
  console.log(session.id)
}})
`

test("workflow cli run and export emit machine-readable contracts", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Promise.all(["project", "home", "share", "cache", "config", "state"].map((item) => mkdir(path.join(dir, item))))
    },
  })
  const vars = env(tmp.path)
  const project = path.join(tmp.path, "project")
  const failed = await exec({
    env: vars,
    args: [
      "run",
      "--conditions=browser",
      "./src/index.ts",
      "workflow",
      "run",
      "cpiii-resurvey-wiki",
      "--dir",
      project,
      "--input-json",
      '{"project":"CLI process smoke"}',
      "--wait",
    ],
  })
  const run = JSON.parse(failed.stdout) as {
    ok: boolean
    run: { workflowId: string; sessionId: string; artifacts?: { markdownPath: string }[] }
    acceptance?: { checks: { id: string; status: string }[] }
  }

  expect(failed.code).toBe(1)
  expect(run.ok).toBe(false)
  expect(run.run.workflowId).toBe("cpiii-resurvey-wiki")
  expect(run.run.sessionId.length).toBeGreaterThan(0)
  expect(run.run.artifacts?.[0]?.markdownPath).toContain("wiki/changes/format-coverage-")
  expect(run.acceptance?.checks.find((check) => check.id === "messages")?.status).toBe("fail")

  const seeded = await exec({
    env: vars,
    args: ["-e", seed, project],
  })
  const session = seeded.stdout.trim()
  expect(seeded.code).toBe(0)
  expect(session).toStartWith("ses_")

  const archived = await exec({
    env: vars,
    args: [
      "run",
      "--conditions=browser",
      "./src/index.ts",
      "workflow",
      "export",
      session,
      "--workflow",
      "cpiii-resurvey-wiki",
      "--dir",
      project,
    ],
  })
  const exported = JSON.parse(archived.stdout) as {
    ok: boolean
    delivery?: { workflowId: string; fileCount?: number; manifestPath?: string; absoluteManifestPath?: string }
  }

  expect(archived.code).toBe(0)
  expect(exported.ok).toBe(true)
  expect(exported.delivery?.workflowId).toBe("cpiii-resurvey-wiki")
  expect(exported.delivery?.fileCount).toBe(4)
  expect(exported.delivery?.manifestPath).toContain("manifest.json")
  if (!exported.delivery?.absoluteManifestPath) throw new Error("missing manifest path")

  const manifest = (await Bun.file(exported.delivery.absoluteManifestPath).json()) as {
    kind: string
    delivery: { version: number; files: { kind: string }[] }
    acceptance: { ok: boolean }
  }

  expect(manifest.kind).toBe("railwise.workflow.delivery")
  expect(manifest.delivery.version).toBe(1)
  expect(manifest.delivery.files.map((file) => file.kind)).toEqual(["summary", "artifact", "artifact", "manifest"])
  expect(manifest.acceptance.ok).toBe(true)
})
