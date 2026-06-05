import { describe, expect, test } from "bun:test"
import path from "path"
import * as XLSX from "xlsx"
import { Instance } from "../../src/project/instance"
import {
  DocxReportFormatterTool,
  DxfLayerInspectorTool,
  FileReaderTool,
  LevelingClosureTool,
  MonitoringDataFirstCheckTool,
  PdfFormCheckerTool,
  PptxBriefBuilderTool,
  ResurveyMaterialCheckTool,
  StandardQueryTool,
  XlsxQualityCheckerTool,
} from "../../src/tool/railwise-domain"
import { ToolRegistry } from "../../src/tool/registry"
import { tmpdir } from "../fixture/fixture"

const ctx = {
  sessionID: "test",
  messageID: "msg",
  callID: "call",
  agent: "chief_manager",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

function workbook(rows: unknown[][]) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "监测数据")
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" })
}

describe("railwise domain tools", () => {
  test("registers professional engineering tools for model execution", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()

        expect(ids).toContain("file_reader")
        expect(ids).toContain("standard_query_query_standard")
        expect(ids).toContain("survey_calculator_leveling_closure")
        expect(ids).toContain("resurvey_material_check")
        expect(ids).toContain("monitoring_data_first_check")
        expect(ids).toContain("dxf_layer_inspector")
        expect(ids).toContain("xlsx_quality_checker")
        expect(ids).toContain("docx_report_formatter")
        expect(ids).toContain("pptx_brief_builder")
        expect(ids).toContain("pdf_form_checker")
      },
    })
  })

  test("queries built-in standard references", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await StandardQueryTool.init()
        const result = await tool.execute({ query: "轨道交通监测预警" }, ctx)

        expect(result.title).toBe("规范条文查询")
        expect(result.output).toContain("GB 50911")
      },
    })
  })

  test("checks leveling closure against tolerance", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await LevelingClosureTool.init()
        const result = await tool.execute({ closure_mm: 3, route_km: 1 }, ctx)

        expect(result.title).toBe("水准闭合差检核")
        expect(result.output).toContain("闭合差满足限差")
        expect(result.metadata.pass).toBe(true)
      },
    })
  })

  test("scans resurvey, monitoring, dxf, and spreadsheet files", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "控制点成果.xlsx"), workbook([["点号", "高程"], ["CP01", 12.3]]))
        await Bun.write(path.join(dir, "观测记录.csv"), "点号,沉降(mm),状态\nJC-01,-1.2,正常\nJC-02,-6.8,预警\n")
        await Bun.write(path.join(dir, "平差成果表.xlsx"), workbook([["点号", "残差"], ["CP01", 0.2]]))
        await Bun.write(path.join(dir, "复测报告.docx"), "report")
        await Bun.write(path.join(dir, "签章报告.pdf"), "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF")
        await Bun.write(
          path.join(dir, "线路成果图.dxf"),
          ["0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "0", "LAYER", "2", "CONTROL", "0", "LAYER", "2", "MONITOR", "0", "ENDTAB", "0", "ENDSEC"].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const reader = await FileReaderTool.init()
        const resurvey = await ResurveyMaterialCheckTool.init()
        const monitoring = await MonitoringDataFirstCheckTool.init()
        const dxf = await DxfLayerInspectorTool.init()
        const xlsx = await XlsxQualityCheckerTool.init()
        const docx = await DocxReportFormatterTool.init()
        const pptx = await PptxBriefBuilderTool.init()
        const pdf = await PdfFormCheckerTool.init()

        expect((await reader.execute({ path: ".", limit: 30 }, ctx)).output).toContain("观测记录.csv")
        expect((await resurvey.execute({}, ctx)).output).toContain("控制点成果")
        expect((await monitoring.execute({ threshold_mm: 5 }, ctx)).output).toContain("疑似异常")
        expect((await dxf.execute({ path: "线路成果图.dxf" }, ctx)).output).toContain("CONTROL")
        expect((await xlsx.execute({ path: "控制点成果.xlsx" }, ctx)).output).toContain("监测数据")
        expect((await docx.execute({ report_type: "复测报告" }, ctx)).output).toContain("排版清单")
        expect((await pptx.execute({ project_name: "宁波轨道复测", phase: "成果提交" }, ctx)).output).toContain("宁波轨道复测")
        expect((await pdf.execute({}, ctx)).output).toContain("PDF 文件")
      },
    })
  })
})
