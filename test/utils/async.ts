/**
 * Async test helpers for handling promises, timeouts, and async operations
 */

import { expect } from "@rstest/core"

/**
 * Wait for a condition to be true with timeout
 */
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    message?: string
  } = {},
): Promise<void> => {
  const { timeout = 5000, interval = 100, message = "Condition not met within timeout" } = options

  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const result = await condition()
    if (result) {
      return
    }
    await sleep(interval)
  }

  throw new Error(message)
}

/**
 * Wait for an element to appear in the DOM
 */
export const waitForElement = async (
  selector: string,
  options: {
    timeout?: number
    interval?: number
    container?: Document | Element
  } = {},
): Promise<Element> => {
  const { timeout = 5000, interval = 100, container = document } = options

  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const check = () => {
      const element = container.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Element "${selector}" not found within ${timeout}ms`))
        return
      }

      setTimeout(check, interval)
    }

    check()
  })
}

/**
 * Wait for an element to disappear from the DOM
 */
export const waitForElementToDisappear = async (
  selector: string,
  options: {
    timeout?: number
    interval?: number
    container?: Document | Element
  } = {},
): Promise<void> => {
  const { timeout = 5000, interval = 100, container = document } = options

  await waitFor(() => !container.querySelector(selector), {
    timeout,
    interval,
    message: `Element "${selector}" did not disappear within ${timeout}ms`,
  })
}

/**
 * Sleep for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for a promise to resolve with timeout
 */
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, message = "Promise timed out"): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ])
}

/**
 * Retry an async operation with exponential backoff
 */
export const retry = async <T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    baseDelay?: number
    maxDelay?: number
    backoffFactor?: number
    shouldRetry?: (error: Error) => boolean
  } = {},
): Promise<T> => {
  const { maxAttempts = 3, baseDelay = 100, maxDelay = 5000, backoffFactor = 2, shouldRetry = () => true } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError
      }

      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay)
      await sleep(delay)
    }
  }

  throw lastError!
}

/**
 * Wait for multiple promises to resolve
 */
export const waitForAll = async <T>(promises: Promise<T>[], timeout = 10000): Promise<T[]> => {
  return withTimeout(Promise.all(promises), timeout, `Not all promises resolved within ${timeout}ms`)
}

/**
 * Wait for any promise to resolve
 */
export const waitForAny = async <T>(promises: Promise<T>[], timeout = 10000): Promise<T> => {
  return withTimeout(Promise.race(promises), timeout, `No promise resolved within ${timeout}ms`)
}

/**
 * Debounce an async function
 */
export const debounce = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  delay: number,
): ((...args: T) => Promise<R>) => {
  let timeoutId: NodeJS.Timeout | null = null
  let resolvePromise: ((value: R) => void) | null = null
  let rejectPromise: ((error: Error) => void) | null = null

  return (...args: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      resolvePromise = resolve
      rejectPromise = reject

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args)
          resolvePromise?.(result)
        } catch (error) {
          rejectPromise?.(error as Error)
        }
      }, delay)
    })
  }
}

/**
 * Throttle an async function
 */
export const throttle = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  delay: number,
): ((...args: T) => Promise<R | null>) => {
  let lastCall = 0
  let pendingPromise: Promise<R> | null = null

  return async (...args: T): Promise<R | null> => {
    const now = Date.now()

    if (now - lastCall >= delay) {
      lastCall = now
      pendingPromise = fn(...args)
      return pendingPromise
    }

    return null
  }
}

/**
 * Create a deferred promise
 */
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
  isResolved: boolean
  isRejected: boolean
}

export const createDeferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void
  let reject: (error: Error) => void
  let isResolved = false
  let isRejected = false

  const promise = new Promise<T>((res, rej) => {
    resolve = (value: T) => {
      isResolved = true
      res(value)
    }
    reject = (error: Error) => {
      isRejected = true
      rej(error)
    }
  })

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
    isResolved,
    isRejected,
  }
}

/**
 * Wait for a function to be called
 */
export const waitForCall = <T extends any[], R>(
  fn: (...args: T) => R,
  timeout = 5000,
): Promise<{ args: T; result: R }> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Function not called within ${timeout}ms`))
    }, timeout)

    const wrapper = (...args: T): R => {
      clearTimeout(timeoutId)
      const result = fn(...args)
      resolve({ args, result })
      return result
    }

    // Replace the original function
    Object.setPrototypeOf(wrapper, Object.getPrototypeOf(fn))
    Object.defineProperty(wrapper, "name", { value: fn.name })
  })
}

/**
 * Mock async function with controllable timing
 */
export class AsyncMock<T extends any[], R> {
  private calls: Array<{ args: T; timestamp: number }> = []
  private responses: R[] = []
  private errors: Error[] = []
  private delays: number[] = []
  private currentIndex = 0

  constructor(private defaultDelay = 0) {}

  // Configure responses
  mockResolvedValue(value: R): this {
    this.responses.push(value)
    return this
  }

  mockRejectedValue(error: Error): this {
    this.errors.push(error)
    return this
  }

  mockDelay(delay: number): this {
    this.delays.push(delay)
    return this
  }

  // Create the mock function
  create(): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      this.calls.push({ args, timestamp: Date.now() })

      const delay = this.delays[this.currentIndex] ?? this.defaultDelay
      if (delay > 0) {
        await sleep(delay)
      }

      if (this.errors[this.currentIndex]) {
        throw this.errors[this.currentIndex]
      }

      const response = this.responses[this.currentIndex]
      this.currentIndex++

      return response
    }
  }

  // Inspection methods
  getCalls(): Array<{ args: T; timestamp: number }> {
    return [...this.calls]
  }

  getCallCount(): number {
    return this.calls.length
  }

  getLastCall(): { args: T; timestamp: number } | undefined {
    return this.calls[this.calls.length - 1]
  }

  wasCalledWith(...args: T): boolean {
    return this.calls.some(
      (call) => call.args.length === args.length && call.args.every((arg, index) => arg === args[index]),
    )
  }

  reset(): void {
    this.calls = []
    this.currentIndex = 0
  }
}

/**
 * Test async error handling
 */
export const expectAsyncError = async <T>(
  promise: Promise<T>,
  expectedError?: string | RegExp | Error,
): Promise<Error> => {
  try {
    await promise
    throw new Error("Expected promise to reject, but it resolved")
  } catch (error) {
    const err = error as Error

    if (expectedError) {
      if (typeof expectedError === "string") {
        expect(err.message).toContain(expectedError)
      } else if (expectedError instanceof RegExp) {
        expect(err.message).toMatch(expectedError)
      } else if (expectedError instanceof Error) {
        expect(err.message).toBe(expectedError.message)
      }
    }

    return err
  }
}

/**
 * Measure async operation performance
 */
export const measureAsync = async <T>(
  operation: () => Promise<T>,
): Promise<{ result: T; duration: number; memoryUsed?: number }> => {
  const startTime = Date.now()
  const startMemory = process.memoryUsage?.()?.heapUsed

  const result = await operation()

  const duration = Date.now() - startTime
  const endMemory = process.memoryUsage?.()?.heapUsed
  const memoryUsed = startMemory && endMemory ? endMemory - startMemory : undefined

  return { result, duration, memoryUsed }
}

/**
 * Batch async operations with concurrency control
 */
export const batchAsync = async <T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<R[]> => {
  const { concurrency = 5, onProgress } = options
  const results: R[] = new Array(items.length)
  let completed = 0

  const executeItem = async (index: number): Promise<void> => {
    results[index] = await operation(items[index], index)
    completed++
    onProgress?.(completed, items.length)
  }

  // Process items in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchPromises = batch.map((_, batchIndex) => executeItem(i + batchIndex))
    await Promise.all(batchPromises)
  }

  return results
}

/**
 * Create a timeout that can be cleared
 */
export class TimeoutManager {
  private timeouts = new Set<NodeJS.Timeout>()

  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeoutId = setTimeout(() => {
      this.timeouts.delete(timeoutId)
      callback()
    }, delay)

    this.timeouts.add(timeoutId)
    return timeoutId
  }

  clearTimeout(timeoutId: NodeJS.Timeout): void {
    clearTimeout(timeoutId)
    this.timeouts.delete(timeoutId)
  }

  clearAll(): void {
    for (const timeoutId of this.timeouts) {
      clearTimeout(timeoutId)
    }
    this.timeouts.clear()
  }

  getActiveCount(): number {
    return this.timeouts.size
  }
}

/**
 * Global timeout manager for tests
 */
export const timeoutManager = new TimeoutManager()

/**
 * Cleanup helper for test teardown
 */
export const cleanupAsync = () => {
  timeoutManager.clearAll()
}
