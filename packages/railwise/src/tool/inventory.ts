import { ToolRegistry } from "./registry"

export const ToolGroups = ["agent", "knowledge", "survey", "core", "extension"] as const

export type ToolGroup = (typeof ToolGroups)[number]

const labels: Record<string, string> = {
  task: "协作智能体调度",
  skill: "Skill 加载器",
  tool_wiki_query: "规范 Wiki 查询",
  tool_wiki_ingest: "规范资料入库",
  tool_wiki_index: "规范索引重建",
  tool_wiki_lint: "规范库质检",
  tool_norm_search: "规范条文检索",
  tool_norm_diff: "规范版本对比",
  tool_norm_cite: "规范引用固化",
  tool_format_converter: "测量格式转换",
  tool_adjustment_indirect: "间接平差",
  tool_adjustment_free_network: "自由网平差",
  tool_adjustment_robust: "稳健平差",
  tool_variance_component: "方差分量估计",
  tool_adjustment_condition: "条件平差",
  tool_gross_error_detection: "粗差探测",
  angle_convert_angle_convert: "角度格式转换",
  angle_convert_decimal_to_dms: "十进制度转度分秒",
  angle_convert_dms_to_decimal: "度分秒转十进制度",
  axial_force_axial_force_calc: "支撑轴力换算",
  axial_force_axial_force_comparison: "轴力多期对比",
  chart_generator: "监测趋势图生成",
  control_network_network_design: "控制网布设设计",
  control_network_plane_network_adjustment: "平面控制网平差",
  coord_transform_datum_transform: "坐标基准转换",
  coord_transform_gauss_forward: "高斯正算",
  coord_transform_gauss_inverse: "高斯反算",
  cpiii_adjustment_cpiii_network_adjustment: "CPIII 控制网平差",
  cpiii_adjustment_free_station_resection: "自由设站后方交会",
  cross_section_clearance_check: "断面限界检查",
  cross_section_convergence_calc: "隧道收敛计算",
  cross_section_profile_comparison: "断面多期对比",
  deformation_rate_deformation_comparison: "变形量多期对比",
  deformation_rate_deformation_rate: "变形速率分析",
  distance_calculator_atmospheric_correction: "气象改正",
  distance_calculator_distance_reduction: "边长归算",
  distance_calculator_projection_correction: "投影改正",
  distance_calculator_slope_to_horizontal: "斜距转平距",
  excel_export_excel_export: "Excel 成果表导出",
  excel_export_monitoring_table_export: "监测数据表导出",
  format_parser: "仪器原始格式解析",
  inclinometer_inclinometer_profile: "测斜剖面分析",
  inclinometer_inclinometer_trend: "测斜趋势分析",
  monitoring_csv: "监测 CSV 清洗分析",
  pile_stakeout_batch_stakeout_points: "放样点批量计算",
  pile_stakeout_chainage_offset: "里程偏距计算",
  pile_stakeout_polar_stakeout: "极坐标放样",
  report_export: "Word 成果报告导出",
  shield_guidance_shield_position: "盾构姿态计算",
  shield_guidance_shield_ring_build: "管片拼装分析",
  shield_guidance_shield_trend: "盾构趋势分析",
  standard_query_list_standards: "规范库清单",
  standard_query_query_standard: "规范条文查询",
  survey_calculator_alert_level: "监测预警分级",
  survey_calculator_leveling_adjustment: "水准网严密平差",
  survey_calculator_leveling_closure: "水准闭合差检核",
  survey_calculator_traverse_adjustment: "导线网严密平差",
  survey_calculator_traverse_closure: "导线闭合差检核",
  water_level_water_level_analysis: "地下水位分析",
  water_level_water_level_contour: "地下水位等值线",
  file_reader: "本地文件读取",
  resurvey_material_check: "复测资料检查",
  monitoring_data_first_check: "监测数据首检",
  dxf_layer_inspector: "DXF 图层检查",
  xlsx_quality_checker: "Excel 表格校验",
  docx_report_formatter: "Word 成果排版",
  pptx_brief_builder: "PPT 汇报生成",
  pdf_form_checker: "PDF 表单检查",
  bash: "命令执行",
  read: "文件读取",
  glob: "文件搜索",
  grep: "文本搜索",
  edit: "文件编辑",
  write: "文件写入",
  webfetch: "网页读取",
  websearch: "网页搜索",
  codesearch: "代码搜索",
  todowrite: "任务清单",
  question: "问题确认",
  apply_patch: "补丁编辑",
}

function group(id: string): ToolGroup {
  if (id === "task" || id === "skill") return "agent"
  if (id.startsWith("tool_wiki_") || id.startsWith("tool_norm_") || id.startsWith("standard_query_")) return "knowledge"
  if (
    id.startsWith("tool_adjustment_") ||
    id === "tool_format_converter" ||
    id === "tool_gross_error_detection" ||
    id === "tool_variance_component" ||
    [
      "angle_convert_",
      "axial_force_",
      "control_network_",
      "coord_transform_",
      "cpiii_adjustment_",
      "cross_section_",
      "deformation_rate_",
      "distance_calculator_",
      "excel_export_",
      "inclinometer_",
      "pile_stakeout_",
      "shield_guidance_",
      "survey_calculator_",
      "water_level_",
    ].some((prefix) => id.startsWith(prefix)) ||
    [
      "chart_generator",
      "format_parser",
      "monitoring_csv",
      "report_export",
      "resurvey_material_check",
      "monitoring_data_first_check",
      "dxf_layer_inspector",
      "xlsx_quality_checker",
      "docx_report_formatter",
      "pptx_brief_builder",
      "pdf_form_checker",
    ].includes(id)
  ) {
    return "survey"
  }
  if (
    [
      "bash",
      "read",
      "glob",
      "grep",
      "edit",
      "write",
      "webfetch",
      "websearch",
      "codesearch",
      "todowrite",
      "question",
      "apply_patch",
      "file_reader",
    ].includes(id)
  ) {
    return "core"
  }
  return "extension"
}

export function toolLabel(id: string) {
  return labels[id] ?? id.replace(/^tool_/, "").replaceAll("_", " ")
}

export async function toolInventory() {
  return ToolRegistry.ids().then((ids) =>
    ids
      .filter((id) => id !== "invalid")
      .map((id) => ({
        id,
        label: toolLabel(id),
        group: group(id),
      }))
      .sort(
        (a, b) =>
          ToolGroups.indexOf(a.group) - ToolGroups.indexOf(b.group) || a.label.localeCompare(b.label, "zh-Hans-CN"),
      ),
  )
}
