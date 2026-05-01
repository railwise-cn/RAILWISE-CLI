import { expect, test } from "bun:test"
import { mkdir } from "fs/promises"
import path from "path"
import { exportWorkflow, runWorkflow } from "../../src/cli/cmd/workflow"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import type { MessageV2 } from "../../src/session/message-v2"
import { tmpdir } from "../fixture/fixture"

async function user(sessionID: string, text: string) {
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "user",
    sessionID,
    agent: "chief_manager",
    model: {
      providerID: "test",
      modelID: "test",
    },
    time: {
      created: Date.now(),
    },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: message.id,
    sessionID,
    type: "text",
    text,
  })
  return message
}

async function assistant(sessionID: string, parentID: string, text: string) {
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "assistant",
    sessionID,
    mode: "build",
    agent: "chief_manager",
    path: {
      cwd: ".",
      root: ".",
    },
    cost: 0,
    tokens: {
      output: 0,
      input: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    modelID: "test",
    providerID: "test",
    parentID,
    time: {
      created: Date.now(),
      completed: Date.now(),
    },
    finish: "end_turn",
  } satisfies MessageV2.Assistant)
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: message.id,
    sessionID,
    type: "text",
    text,
  })
  return message
}

test("workflow run returns JSON-ready session and acceptance state", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const result = await runWorkflow({
        workflowId: "cpiii-resurvey-wiki",
        input: { project: "CLI smoke" },
        acceptance: true,
      })

      expect(result.ok).toBe(false)
      expect(result.run.workflowId).toBe("cpiii-resurvey-wiki")
      expect(result.run.sessionId.length).toBeGreaterThan(0)
      expect(result.run.agentNames).toContain("chief_manager")
      expect(result.run.artifacts?.[0]?.markdownPath).toContain("wiki/changes/format-coverage-")
      expect(result.acceptance?.checks.find((check) => check.id === "messages")?.status).toBe("fail")

      const exported = await exportWorkflow({ sessionId: result.run.sessionId })
      expect(exported.ok).toBe(false)
      expect(exported.acceptance?.workflowId).toBe("cpiii-resurvey-wiki")
      expect(exported.delivery).toBeUndefined()
    },
  })
})

test("workflow export archives accepted delivery package", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const session = await Session.create({ title: "CLI workflow export" })
      const md = "wiki/changes/format-coverage-2026-04-30.md"
      const json = "wiki/changes/format-coverage-2026-04-30.json"
      const root = path.join(tmp.path, ".railwise", "norm-library")
      await mkdir(path.join(root, "wiki", "changes"), { recursive: true })
      await Bun.write(path.join(root, md), "# Format coverage\n")
      await Bun.write(path.join(root, json), '{"ready":true}\n')
      const parent = await user(
        session.id,
        `Artifacts:\n- Format coverage Markdown: ${md}\n- Format coverage JSON: ${json}`,
      )
      await assistant(
        session.id,
        parent.id,
        [
          "# CPIII delivery",
          "",
          "## 附件引用",
          `- 格式兼容性质检报告 Markdown: ${md}`,
          `- 格式兼容性质检报告 JSON: ${json}`,
          "",
          "## 规范引用",
          "- wiki_page_path: wiki/clauses/cpiii-precision.md",
          "- raw_source_md: raw/tb10601.md",
          "- norm_clause_id: TB10601-3.1",
          "",
          "## 工具结果摘要",
          "- 格式样本 6/6 可用，warning 2 条。",
          "- sigma0、残差、自由网、粗差、稳健、方差分量、条件平差均已汇总。",
        ].join("\n"),
      )

      const result = await exportWorkflow({ sessionId: session.id, workflowId: "cpiii-resurvey-wiki" })
      const delivery = result.delivery

      expect(result.ok).toBe(true)
      expect(result.acceptance?.ok).toBe(true)
      expect(delivery?.workflowId).toBe("cpiii-resurvey-wiki")
      expect(delivery?.fileCount).toBe(4)
      expect(delivery?.markdownPath).toContain("summary.md")
      expect(delivery?.manifestPath).toContain("manifest.json")
      if (!delivery?.absoluteManifestPath) throw new Error("manifest path missing")

      const manifest = (await Bun.file(delivery.absoluteManifestPath).json()) as {
        kind: string
        delivery: { version: number; files: { kind: string }[] }
        acceptance: { ok: boolean }
        references: { path: string }[]
      }

      expect(JSON.parse(JSON.stringify(result)).ok).toBe(true)
      expect(manifest.kind).toBe("railwise.workflow.delivery")
      expect(manifest.delivery.version).toBe(1)
      expect(manifest.delivery.files.map((file) => file.kind)).toEqual(["summary", "artifact", "artifact", "manifest"])
      expect(manifest.acceptance.ok).toBe(true)
      expect(manifest.references.map((reference) => reference.path)).toEqual([md, json])
    },
  })
})
