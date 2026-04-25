export interface StartupPhase {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  budget?: number
  status: 'running' | 'completed' | 'exceeded' | 'failed' | 'retrying'
  retryCount?: number
}

export interface PerformanceBudgetConfig {
  budget: number // ms
  maxRetries: number
  retryStrategy: 'restart' | 'fallback' | 'continue'
}

export interface StartupBudgets {
  'app-init': PerformanceBudgetConfig
  'sidecar-init': PerformanceBudgetConfig
  'server-connect': PerformanceBudgetConfig
  'ui-ready': PerformanceBudgetConfig
  total: { budget: number } // Overall 3s budget
}

// Performance budget configuration with retry and fallback strategies
export const DEFAULT_BUDGETS: StartupBudgets = {
  'app-init': {
    budget: 500,
    maxRetries: 1,
    retryStrategy: 'restart' // Fail fast if basic setup fails
  },
  'sidecar-init': {
    budget: 2000,
    maxRetries: 2,
    retryStrategy: 'fallback' // Retry with fresh port, fallback to cached URL
  },
  'server-connect': {
    budget: 1000,
    maxRetries: 2,
    retryStrategy: 'fallback' // Retry with cached URL, different ports
  },
  'ui-ready': {
    budget: 500,
    maxRetries: 1,
    retryStrategy: 'continue' // Degrade gracefully but continue
  },
  total: {
    budget: 3000 // M1 requirement: < 3s interactive
  }
}

export class StartupTimer {
  private phases: Map<string, StartupPhase> = new Map()
  private startTime = performance.now()
  private budgets: StartupBudgets
  private readonly onBudgetExceeded?: (phase: string, phase_data: StartupPhase) => Promise<boolean>
  private totalBudgetExceeded = false

  constructor(budgets: StartupBudgets = DEFAULT_BUDGETS, onBudgetExceeded?: (phase: string, phase_data: StartupPhase) => Promise<boolean>) {
    this.budgets = budgets
    this.onBudgetExceeded = onBudgetExceeded
  }

  startPhase(name: string): void {
    const budget = name in this.budgets ? (this.budgets as any)[name]?.budget : undefined
    this.phases.set(name, {
      name,
      startTime: performance.now(),
      budget,
      status: 'running',
      retryCount: 0
    })

    if (budget) {
      console.log(`🕐 Starting ${name} (budget: ${budget}ms)`)
    } else {
      console.log(`🕐 Starting ${name}`)
    }
  }

  async endPhase(name: string): Promise<{ duration: number, budgetExceeded: boolean, shouldRetry: boolean }> {
    const phase = this.phases.get(name)
    if (!phase) {
      console.warn(`Phase ${name} not found`)
      return { duration: 0, budgetExceeded: false, shouldRetry: false }
    }

    const endTime = performance.now()
    const duration = endTime - phase.startTime
    const budget = phase.budget
    const budgetExceeded = budget ? duration > budget : false

    // Update phase with completion data
    const updatedPhase: StartupPhase = {
      ...phase,
      endTime,
      duration,
      status: budgetExceeded ? 'exceeded' : 'completed'
    }
    this.phases.set(name, updatedPhase)

    // Log phase completion
    if (budgetExceeded && budget) {
      console.warn(`⚠️ ${name}: ${duration.toFixed(2)}ms (exceeded ${budget}ms budget by ${(duration - budget).toFixed(2)}ms)`)
    } else {
      console.log(`✅ ${name}: ${duration.toFixed(2)}ms${budget ? ` (${budget - duration >= 0 ? 'within' : 'exceeded'} ${budget}ms budget)` : ''}`)
    }

    // Check total budget
    const totalTime = this.getTotalTime()
    if (!this.totalBudgetExceeded && totalTime > this.budgets.total.budget) {
      this.totalBudgetExceeded = true
      console.warn(`🚨 Total startup time exceeded 3s budget: ${totalTime.toFixed(2)}ms`)
    }

    // Handle budget exceeded with retry logic
    let shouldRetry = false
    if (budgetExceeded && name in this.budgets && this.onBudgetExceeded) {
      const budgetConfig = (this.budgets as any)[name] as PerformanceBudgetConfig
      const retryCount = (phase.retryCount || 0)

      if (retryCount < budgetConfig.maxRetries) {
        console.log(`🔄 Attempting retry ${retryCount + 1}/${budgetConfig.maxRetries} for ${name}`)

        // Mark as retrying
        this.phases.set(name, {
          ...updatedPhase,
          status: 'retrying',
          retryCount: retryCount + 1
        })

        // Ask callback if we should retry
        shouldRetry = await this.onBudgetExceeded(name, updatedPhase)

        if (shouldRetry) {
          // Reset phase for retry
          this.startPhase(name)
          return { duration, budgetExceeded: true, shouldRetry: true }
        }
      }

      // No more retries or callback said no - mark as failed or continue
      const finalStatus = budgetConfig.retryStrategy === 'continue' ? 'exceeded' : 'failed'
      this.phases.set(name, {
        ...updatedPhase,
        status: finalStatus
      })

      if (finalStatus === 'failed') {
        console.error(`❌ ${name} failed after ${retryCount} retries`)
      } else {
        console.warn(`⚠️ ${name} continuing despite budget exceeded`)
      }
    }

    return { duration, budgetExceeded, shouldRetry }
  }

  retryPhase(name: string): void {
    const phase = this.phases.get(name)
    if (!phase) {
      console.warn(`Phase ${name} not found for retry`)
      return
    }

    // Restart the phase
    this.startPhase(name)
  }

  getTotalTime(): number {
    return performance.now() - this.startTime
  }

  getReport(): { phases: StartupPhase[], total: number, budgetStatus: 'ok' | 'warning' | 'exceeded' } {
    const total = this.getTotalTime()
    let budgetStatus: 'ok' | 'warning' | 'exceeded' = 'ok'

    if (total > this.budgets.total.budget) {
      budgetStatus = 'exceeded'
    } else if (total > this.budgets.total.budget * 0.8) {
      budgetStatus = 'warning'
    }

    return {
      phases: Array.from(this.phases.values()),
      total,
      budgetStatus
    }
  }

  getPhaseStatus(name: string): StartupPhase | undefined {
    return this.phases.get(name)
  }

  isBudgetExceeded(name: string): boolean {
    const phase = this.phases.get(name)
    return phase ? (phase.duration || 0) > (phase.budget || Infinity) : false
  }
}

// Legacy export - create default instance
export const startupTimer = new StartupTimer()