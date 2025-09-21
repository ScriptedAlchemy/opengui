/**
 * Performance measurement utilities for testing
 */

import { expect } from "@rstest/core"

export interface PerformanceMetrics {
  duration: number
  memoryUsed?: number
  cpuUsage?: number
  timestamp: number
}

export interface PerformanceBenchmark {
  name: string
  metrics: PerformanceMetrics
  iterations?: number
  baseline?: PerformanceMetrics
}

/**
 * Measure execution time and memory usage
 */
export const measurePerformance = async <T>(
  operation: () => Promise<T> | T,
): Promise<{ result: T; metrics: PerformanceMetrics }> => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc()
  }

  const startTime = performance.now()
  const startMemory = process.memoryUsage?.()?.heapUsed || 0

  const result = await operation()

  const endTime = performance.now()
  const endMemory = process.memoryUsage?.()?.heapUsed || 0

  const metrics: PerformanceMetrics = {
    duration: endTime - startTime,
    memoryUsed: endMemory - startMemory,
    timestamp: Date.now(),
  }

  return { result, metrics }
}

/**
 * Run performance benchmark with multiple iterations
 */
export const benchmark = async <T>(
  operation: () => Promise<T> | T,
  options: {
    name?: string
    iterations?: number
    warmupIterations?: number
    maxDuration?: number
    minIterations?: number
  } = {},
): Promise<PerformanceBenchmark> => {
  const {
    name = "benchmark",
    iterations = 100,
    warmupIterations = 10,
    maxDuration = 30000, // 30 seconds max
    minIterations = 5,
  } = options

  // Warmup runs
  for (let i = 0; i < warmupIterations; i++) {
    await operation()
  }

  const results: PerformanceMetrics[] = []
  const startTime = Date.now()

  for (let i = 0; i < iterations; i++) {
    // Check if we've exceeded max duration
    if (Date.now() - startTime > maxDuration && i >= minIterations) {
      break
    }

    const { metrics } = await measurePerformance(operation)
    results.push(metrics)
  }

  // Calculate aggregate metrics
  const durations = results.map((r) => r.duration)
  const memoryUsages = results.map((r) => r.memoryUsed || 0)

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
  const avgMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length

  return {
    name,
    metrics: {
      duration: avgDuration,
      memoryUsed: avgMemory,
      timestamp: Date.now(),
    },
    iterations: results.length,
  }
}

/**
 * Compare performance between two operations
 */
export const comparePerformance = async <T, U>(
  baseline: () => Promise<T> | T,
  candidate: () => Promise<U> | U,
  options: {
    iterations?: number
    tolerance?: number
  } = {},
): Promise<{
  baseline: PerformanceBenchmark
  candidate: PerformanceBenchmark
  comparison: {
    durationRatio: number
    memoryRatio: number
    isImprovement: boolean
    significantDifference: boolean
  }
}> => {
  const { iterations = 50, tolerance = 0.05 } = options

  const baselineResult = await benchmark(baseline, {
    name: "baseline",
    iterations,
  })

  const candidateResult = await benchmark(candidate, {
    name: "candidate",
    iterations,
  })

  const durationRatio = candidateResult.metrics.duration / baselineResult.metrics.duration
  const memoryRatio = (candidateResult.metrics.memoryUsed || 0) / (baselineResult.metrics.memoryUsed || 1)

  const isImprovement = durationRatio < 1 && memoryRatio <= 1
  const significantDifference = Math.abs(durationRatio - 1) > tolerance

  return {
    baseline: baselineResult,
    candidate: candidateResult,
    comparison: {
      durationRatio,
      memoryRatio,
      isImprovement,
      significantDifference,
    },
  }
}

/**
 * Memory leak detection
 */
export class MemoryLeakDetector {
  private snapshots: Array<{ name: string; heapUsed: number; timestamp: number }> = []

  takeSnapshot(name: string) {
    if (global.gc) {
      global.gc()
    }

    const heapUsed = process.memoryUsage?.()?.heapUsed || 0
    this.snapshots.push({
      name,
      heapUsed,
      timestamp: Date.now(),
    })
  }

  detectLeaks(threshold = 1024 * 1024): Array<{ from: string; to: string; leaked: number }> {
    const leaks: Array<{ from: string; to: string; leaked: number }> = []

    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1]
      const curr = this.snapshots[i]
      const leaked = curr.heapUsed - prev.heapUsed

      if (leaked > threshold) {
        leaks.push({
          from: prev.name,
          to: curr.name,
          leaked,
        })
      }
    }

    return leaks
  }

  getSnapshots() {
    return [...this.snapshots]
  }

  clear() {
    this.snapshots = []
  }
}

/**
 * Performance regression testing
 */
export class PerformanceRegression {
  private baselines = new Map<string, PerformanceMetrics>()

  setBaseline(name: string, metrics: PerformanceMetrics) {
    this.baselines.set(name, metrics)
  }

  async checkRegression(
    name: string,
    operation: () => Promise<any> | any,
    options: {
      tolerance?: number
      iterations?: number
    } = {},
  ): Promise<{
    passed: boolean
    current: PerformanceMetrics
    baseline?: PerformanceMetrics
    regression?: number
  }> {
    const { tolerance = 0.2, iterations = 10 } = options

    const benchmark = await this.benchmark(operation, { name, iterations })
    const current = benchmark.metrics
    const baseline = this.baselines.get(name)

    if (!baseline) {
      this.setBaseline(name, current)
      return { passed: true, current }
    }

    const regression = (current.duration - baseline.duration) / baseline.duration
    const passed = regression <= tolerance

    return {
      passed,
      current,
      baseline,
      regression,
    }
  }

  private async benchmark(operation: () => any, options: { name: string; iterations: number }) {
    return benchmark(operation, options)
  }
}

/**
 * Resource usage monitoring
 */
export class ResourceMonitor {
  private monitoring = false
  private samples: Array<{
    timestamp: number
    memory: NodeJS.MemoryUsage
    cpu?: number
  }> = []
  private intervalId?: NodeJS.Timeout

  start(intervalMs = 100) {
    if (this.monitoring) return

    this.monitoring = true
    this.samples = []

    this.intervalId = setInterval(() => {
      this.samples.push({
        timestamp: Date.now(),
        memory: process.memoryUsage(),
      })
    }, intervalMs)
  }

  stop() {
    if (!this.monitoring) return

    this.monitoring = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  getStats() {
    if (this.samples.length === 0) {
      return null
    }

    const memoryUsages = this.samples.map((s) => s.memory.heapUsed)
    const maxMemory = Math.max(...memoryUsages)
    const minMemory = Math.min(...memoryUsages)
    const avgMemory = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length

    return {
      duration: this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp,
      samples: this.samples.length,
      memory: {
        max: maxMemory,
        min: minMemory,
        avg: avgMemory,
        peak: maxMemory - minMemory,
      },
    }
  }

  getSamples() {
    return [...this.samples]
  }

  clear() {
    this.samples = []
  }
}

/**
 * Performance assertions
 */
export const assertPerformance = (
  metrics: PerformanceMetrics,
  expectations: {
    maxDuration?: number
    maxMemory?: number
    minDuration?: number
  },
) => {
  if (expectations.maxDuration !== undefined) {
    expect(metrics.duration).toBeLessThanOrEqual(expectations.maxDuration)
  }

  if (expectations.minDuration !== undefined) {
    expect(metrics.duration).toBeGreaterThanOrEqual(expectations.minDuration)
  }

  if (expectations.maxMemory !== undefined && metrics.memoryUsed !== undefined) {
    expect(metrics.memoryUsed).toBeLessThanOrEqual(expectations.maxMemory)
  }
}

export const assertNoMemoryLeaks = (detector: MemoryLeakDetector, threshold = 1024 * 1024) => {
  const leaks = detector.detectLeaks(threshold)
  expect(leaks).toHaveLength(0)
}

export const assertPerformanceImprovement = (
  baseline: PerformanceMetrics,
  current: PerformanceMetrics,
  minImprovement = 0.1,
) => {
  const improvement = (baseline.duration - current.duration) / baseline.duration
  expect(improvement).toBeGreaterThanOrEqual(minImprovement)
}

/**
 * Load testing utilities
 */
export const loadTest = async <T>(
  operation: () => Promise<T>,
  options: {
    concurrency?: number
    duration?: number
    requestsPerSecond?: number
    maxRequests?: number
  } = {},
): Promise<{
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  requestsPerSecond: number
  errors: Error[]
}> => {
  const { concurrency = 10, duration = 10000, requestsPerSecond = 100, maxRequests = Infinity } = options

  const results: Array<{ success: boolean; duration: number; error?: Error }> = []
  const errors: Error[] = []
  const startTime = Date.now()

  const workers: Promise<void>[] = []

  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (Date.now() - startTime < duration && results.length < maxRequests) {
          const requestStart = performance.now()

          try {
            await operation()
            results.push({
              success: true,
              duration: performance.now() - requestStart,
            })
          } catch (error) {
            const err = error as Error
            errors.push(err)
            results.push({
              success: false,
              duration: performance.now() - requestStart,
              error: err,
            })
          }

          // Rate limiting
          const delay = 1000 / requestsPerSecond
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      })(),
    )
  }

  await Promise.all(workers)

  const successfulRequests = results.filter((r) => r.success).length
  const failedRequests = results.length - successfulRequests
  const averageResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length
  const actualDuration = Date.now() - startTime
  const actualRequestsPerSecond = results.length / (actualDuration / 1000)

  return {
    totalRequests: results.length,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    requestsPerSecond: actualRequestsPerSecond,
    errors,
  }
}

/**
 * Global performance utilities
 */
export const memoryLeakDetector = new MemoryLeakDetector()
export const performanceRegression = new PerformanceRegression()
export const resourceMonitor = new ResourceMonitor()

/**
 * Test cleanup
 */
export const cleanupPerformance = () => {
  memoryLeakDetector.clear()
  resourceMonitor.stop()
  resourceMonitor.clear()
}
