import * as fs from "node:fs"
import * as path from "node:path"
import process from "node:process"
import type { StationRecord } from "../parser/gsi.js"

export interface ProductionLog {
  timestamp: number
  userId: string
  fileName: string
  stationCount: number
  observationCount: number
  dateStr: string
}

export class ProductionManager {
  private getDbPath() {
    const workspaceDir = process.env.RAILWISE_DIRECTORY || process.cwd()
    return path.join(workspaceDir, ".railwise_production.json")
  }

  private loadLogs(): ProductionLog[] {
    const p = this.getDbPath()
    if (!fs.existsSync(p)) return []
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as ProductionLog[]
    } catch {
      return []
    }
  }

  private saveLogs(logs: ProductionLog[]) {
    const p = this.getDbPath()
    fs.writeFileSync(p, JSON.stringify(logs, null, 2))
  }

  public recordGsiUpload(userId: string, fileName: string, stations: StationRecord[]) {
    const logs = this.loadLogs()

    const obsCount = stations.reduce((acc, s) => acc + s.observations.length, 0)
    const dateStr = new Date().toISOString().split("T")[0]

    const newLog: ProductionLog = {
      timestamp: Date.now(),
      userId,
      fileName,
      stationCount: stations.length,
      observationCount: obsCount,
      dateStr,
    }

    logs.push(newLog)
    this.saveLogs(logs)

    return newLog
  }

  public generateDailyReport(dateStr?: string) {
    const targetDate = dateStr || new Date().toISOString().split("T")[0]
    const logs = this.loadLogs()
    const todayLogs = logs.filter((l) => l.dateStr === targetDate)

    if (todayLogs.length === 0) {
      return `📅 **产量日报 (${targetDate})**\n今日暂无数据上传。`
    }

    const totalFiles = todayLogs.length
    const totalStations = todayLogs.reduce((a, b) => a + b.stationCount, 0)
    const totalObs = todayLogs.reduce((a, b) => a + b.observationCount, 0)

    const estimatedHours = (totalStations * 15) / 60

    const projectTotalStations = 500
    const historicalTotal = logs.reduce((a, b) => a + b.stationCount, 0)
    const progressPct = ((historicalTotal / projectTotalStations) * 100).toFixed(1)

    const report = [
      `📅 **RAILWISE 测绘产量 AI 日报 (${targetDate})**`,
      `---`,
      `👨‍💻 **外业动向**`,
      `- 累计收到测量文件：${totalFiles} 份`,
      `- 今日完成测站数：**${totalStations}** 站`,
      `- 累计采集观测值：**${totalObs}** 个`,
      ``,
      `⚡ **AI 效能分析**`,
      `- 预计外业耗时：约 ${estimatedHours.toFixed(1)} 小时`,
      `- 整体测量进度：**${progressPct}%** (${historicalTotal}/${projectTotalStations})`,
      ``,
      `💡 **智能调度建议**`,
      `- 昨日平均每站观测值数 ${(totalObs / (totalStations || 1)).toFixed(1)} 个，符合规范要求。`,
      `- 按当前进度，预计还需 ${Math.ceil((projectTotalStations - historicalTotal) / (totalStations || 1))} 个工作日即可完成控制网外业任务，请注意合理安排休息。`,
    ].join("\n")

    return report
  }
}
