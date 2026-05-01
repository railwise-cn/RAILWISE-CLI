import { describe, expect, test } from "bun:test"
import type { WorkflowDeliveryArchive } from "@/types/agent-studio"
import {
  deliveryFileCount,
  deliveryFiles,
  deliveryMissingCount,
  deliveryRows,
  deliveryStatus,
} from "./workflow-delivery"

const archive: WorkflowDeliveryArchive = {
  sessionId: "ses_demo",
  workflowId: "cpiii-resurvey-wiki",
  workflowName: "CPIII 规范查询与复测预案",
  version: 1,
  generatedAt: "2026-04-30T10:00:00.000Z",
  directoryPath: ".railwise/workflow-deliveries/ses_demo",
  absoluteDirectoryPath: "/tmp/project/.railwise/workflow-deliveries/ses_demo",
  markdownPath: ".railwise/workflow-deliveries/ses_demo/summary.md",
  absoluteMarkdownPath: "/tmp/project/.railwise/workflow-deliveries/ses_demo/summary.md",
  manifestPath: ".railwise/workflow-deliveries/ses_demo/manifest.json",
  absoluteManifestPath: "/tmp/project/.railwise/workflow-deliveries/ses_demo/manifest.json",
  fileCount: 4,
  files: [
    {
      kind: "summary",
      label: "交付摘要",
      path: ".railwise/workflow-deliveries/ses_demo/summary.md",
      absolutePath: "/tmp/project/.railwise/workflow-deliveries/ses_demo/summary.md",
      copied: true,
    },
    {
      kind: "artifact",
      label: "格式样本覆盖",
      path: ".railwise/workflow-deliveries/ses_demo/format-coverage.md",
      absolutePath: "/tmp/project/.railwise/workflow-deliveries/ses_demo/format-coverage.md",
      sourcePath: "/tmp/project/wiki/changes/format-coverage.md",
      copied: true,
    },
    {
      kind: "manifest",
      label: "Manifest",
      path: ".railwise/workflow-deliveries/ses_demo/manifest.json",
      absolutePath: "/tmp/project/.railwise/workflow-deliveries/ses_demo/manifest.json",
      copied: true,
    },
  ],
}

describe("workflow delivery helpers", () => {
  test("builds stable top-level package rows", () => {
    expect(deliveryRows(archive).map((row) => [row.label, row.path, row.folder])).toEqual([
      ["目录", ".railwise/workflow-deliveries/ses_demo", true],
      ["摘要", ".railwise/workflow-deliveries/ses_demo/summary.md", false],
      ["清单", ".railwise/workflow-deliveries/ses_demo/manifest.json", false],
    ])
  })

  test("keeps manifest file rows inspectable by the UI", () => {
    expect(deliveryFiles(archive).map((file) => [file.kind, file.label, file.status, file.source])).toEqual([
      ["summary", "交付摘要", "已写入", undefined],
      ["artifact", "格式样本覆盖", "已写入", "/tmp/project/wiki/changes/format-coverage.md"],
      ["manifest", "Manifest", "已写入", undefined],
    ])
  })

  test("uses manifest fileCount for the user-facing status", () => {
    expect(deliveryFileCount(archive)).toBe(4)
    expect(deliveryMissingCount(archive)).toBe(0)
    expect(deliveryStatus(archive)).toBe("完整 · 4 个文件")
  })

  test("surfaces missing package files as actionable state", () => {
    const broken: WorkflowDeliveryArchive = {
      ...archive,
      fileCount: undefined,
      files: archive.files?.map((file) =>
        file.kind === "artifact" ? { ...file, copied: false } : file,
      ),
    }

    expect(deliveryFileCount(broken)).toBe(2)
    expect(deliveryMissingCount(broken)).toBe(1)
    expect(deliveryStatus(broken)).toBe("缺失 1 个文件")
  })
})
