export interface StartupPhase {
  name: string
  startTime: number
  endTime?: number
  duration?: number
}

export class StartupTimer {
  private phases: Map<string, StartupPhase> = new Map()
  private startTime = performance.now()

  startPhase(name: string): void {
    this.phases.set(name, {
      name,
      startTime: performance.now()
    })
  }

  endPhase(name: string): number {
    const phase = this.phases.get(name)
    if (!phase) {
      console.warn(`Phase ${name} not found`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - phase.startTime

    this.phases.set(name, {
      ...phase,
      endTime,
      duration
    })

    console.log(`📊 ${name}: ${duration.toFixed(2)}ms`)
    return duration
  }

  getTotalTime(): number {
    return performance.now() - this.startTime
  }

  getReport(): { phases: StartupPhase[], total: number } {
    return {
      phases: Array.from(this.phases.values()),
      total: this.getTotalTime()
    }
  }
}

export const startupTimer = new StartupTimer()