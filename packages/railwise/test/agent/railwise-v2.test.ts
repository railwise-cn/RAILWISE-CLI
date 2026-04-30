import { expect, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Agent } from "../../src/agent/agent"
import { ToolRegistry } from "../../src/tool/registry"
import presets from "../../src/agent/workflow-presets.json"

test("M8 industry agents and wiki tools are available by default", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const agents = await Agent.list()
      const names = agents.map((agent) => agent.name)
      expect(names).toContain("norm_librarian")
      expect(names).toContain("source_ingestor")
      expect(names).toContain("knowledge_curator")
      expect(names).toContain("cpiii_specialist")
      expect(names).toContain("adjustment_computer")
      expect(names).toContain("railway_norm_consultant")
      expect(names).toContain("chief_manager")

      const ids = await ToolRegistry.ids()
      expect(ids).toContain("tool_format_converter")
      expect(ids).toContain("tool_adjustment_indirect")
      expect(ids).toContain("tool_adjustment_robust")
      expect(ids).toContain("tool_adjustment_condition")
      expect(ids).toContain("tool_gross_error_detection")
      expect(ids).toContain("tool_mineru_parse")
      expect(ids).toContain("tool_wiki_query")
      expect(ids).toContain("tool_wiki_ingest")
      expect(ids).toContain("tool_wiki_index")
      expect(ids).toContain("tool_wiki_lint")
      expect(ids).toContain("tool_norm_search")
      expect(ids).toContain("tool_norm_diff")
      expect(ids).toContain("tool_norm_cite")
    },
  })
})

test("CPIII resurvey workflow preset wires the industry agents", () => {
  const workflow = presets.find((item) => item.id === "cpiii-resurvey-wiki")
  expect(workflow?.nodes.map((node) => node.agent)).toEqual([
    "source_ingestor",
    "norm_librarian",
    "railway_norm_consultant",
    "adjustment_computer",
    "cpiii_specialist",
    "knowledge_curator",
    "chief_manager",
  ])
})
