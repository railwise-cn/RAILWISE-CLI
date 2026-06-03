// @ts-expect-error Desktop production typecheck does not include Bun test types.
import { describe, expect, it } from "bun:test"
import { startupConfigPath, startupDiagnosis } from "./startup-diagnosis"

describe("startupDiagnosis", () => {
  it("extracts the railwise config path", () => {
    expect(
      startupConfigPath("Configuration is invalid at /Users/WANGJIAWEI/.config/railwise/railwise.json issues=[]"),
    ).toBe("/Users/WANGJIAWEI/.config/railwise/railwise.json")
  })

  it("classifies invalid config errors", () => {
    const diagnosis = startupDiagnosis(
      "ConfigInvalidError: Configuration is invalid at /Users/WANGJIAWEI/.config/railwise/railwise.json invalid input",
    )

    expect(diagnosis.issue).toBe("config")
    expect(diagnosis.path).toBe("/Users/WANGJIAWEI/.config/railwise/railwise.json")
    expect(diagnosis.action).toBe("打开配置文件")
  })

  it("classifies port conflicts only with explicit conflict evidence", () => {
    expect(startupDiagnosis("listen tcp 127.0.0.1:3000: bind: address already in use").issue).toBe("port")
    expect(startupDiagnosis("local server port=3000 health check timed out").issue).toBe("server")
  })

  it("classifies permission failures", () => {
    expect(startupDiagnosis("Operation not permitted while spawning sidecar").issue).toBe("permission")
  })

  it("classifies sidecar health failures", () => {
    expect(startupDiagnosis("Failed to spawn RAILWISE Server (Health check timed out).").issue).toBe("server")
  })

  it("falls back to unknown for uncategorized errors", () => {
    expect(startupDiagnosis("Unexpected startup crash").issue).toBe("unknown")
  })
})
