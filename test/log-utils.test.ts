import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { Log } from "../src/util/log"

const getEnv = (key: string): string | undefined => {
  const proc = Reflect.get(globalThis, "process") as
    | { env?: Record<string, string | undefined> }
    | undefined
  return proc?.env?.[key]
}

const setEnv = (key: string, value: string | undefined) => {
  const proc = Reflect.get(globalThis, "process") as
    | { env?: Record<string, string | undefined> }
    | undefined
  if (!proc?.env) return
  if (value === undefined) {
    delete proc.env[key]
  } else {
    proc.env[key] = value
  }
}

describe("Log Utilities", () => {
  let originalConsole: typeof console
  let mockConsole: {
    log: ReturnType<typeof rstest.fn>
    error: ReturnType<typeof rstest.fn>
    warn: ReturnType<typeof rstest.fn>
    debug: ReturnType<typeof rstest.fn>
  }

  beforeEach(() => {
    originalConsole = { ...console }
    mockConsole = {
      log: rstest.fn(() => {}),
      error: rstest.fn(() => {}),
      warn: rstest.fn(() => {}),
      debug: rstest.fn(() => {}),
    }
    console.log = mockConsole.log
    console.error = mockConsole.error
    console.warn = mockConsole.warn
    console.debug = mockConsole.debug
  })

  afterEach(() => {
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.warn = originalConsole.warn
    console.debug = originalConsole.debug
  })

  describe("Logger class", () => {
    test("creates logger with default service name", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = new Log.Logger()

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[app] INFO:", "test message")

      setEnv("NODE_ENV", originalEnv)
    })

    test("creates logger with custom service name", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = new Log.Logger({ service: "custom-service" })

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[custom-service] INFO:", "test message")

      setEnv("NODE_ENV", originalEnv)
    })

    test("logs info messages with additional arguments", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = new Log.Logger({ service: "test" })
      const data = { key: "value" }

      logger.info("message with data", data, 123)
      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "message with data", data, 123)

      setEnv("NODE_ENV", originalEnv)
    })

    test("logs error messages", () => {
      const logger = new Log.Logger({ service: "test" })

      logger.error("error message")
      expect(mockConsole.error).toHaveBeenCalledWith("[test] ERROR:", "error message")
    })

    test("logs error messages with additional arguments", () => {
      const logger = new Log.Logger({ service: "test" })
      const error = new Error("test error")

      logger.error("error occurred", error)
      expect(mockConsole.error).toHaveBeenCalledWith("[test] ERROR:", "error occurred", error)
    })

    test("logs warn messages", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = new Log.Logger({ service: "test" })

      logger.warn("warning message")
      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "warning message")

      setEnv("NODE_ENV", originalEnv)
    })

    test("logs warn messages with additional arguments", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = new Log.Logger({ service: "test" })

      logger.warn("warning", "additional", "data")
      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "warning", "additional", "data")

      setEnv("NODE_ENV", originalEnv)
    })

    test("logs debug messages when DEBUG is set", () => {
      const originalDebug = getEnv("DEBUG")
      setEnv("DEBUG", "true")

      const logger = new Log.Logger({ service: "test" })
      logger.debug("debug message")

      expect(mockConsole.debug).toHaveBeenCalledWith("[test] DEBUG:", "debug message")

      setEnv("DEBUG", originalDebug)
    })

    test("does not log debug messages when DEBUG is not set", () => {
      const originalDebug = getEnv("DEBUG")
      setEnv("DEBUG", undefined)

      const logger = new Log.Logger({ service: "test" })
      logger.debug("debug message")

      expect(mockConsole.debug).not.toHaveBeenCalled()

      setEnv("DEBUG", originalDebug)
    })
  })

  describe("Environment-based behavior", () => {
    test("does not log info messages in test environment", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "test")

      const logger = new Log.Logger({ service: "test" })
      logger.info("test message")

      expect(mockConsole.log).not.toHaveBeenCalled()

      setEnv("NODE_ENV", originalEnv)
    })

    test("does not log warn messages in test environment", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "test")

      const logger = new Log.Logger({ service: "test" })
      logger.warn("warning message")

      expect(mockConsole.warn).not.toHaveBeenCalled()

      setEnv("NODE_ENV", originalEnv)
    })

    test("always logs error messages regardless of environment", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "test")

      const logger = new Log.Logger({ service: "test" })
      logger.error("error message")

      expect(mockConsole.error).toHaveBeenCalledWith("[test] ERROR:", "error message")

      setEnv("NODE_ENV", originalEnv)
    })

    test("logs info messages in non-test environment", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = new Log.Logger({ service: "test" })
      logger.info("info message")

      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "info message")

      setEnv("NODE_ENV", originalEnv)
    })

    test("logs warn messages in non-test environment", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "production")

      const logger = new Log.Logger({ service: "test" })
      logger.warn("warning message")

      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "warning message")

      setEnv("NODE_ENV", originalEnv)
    })
  })

  describe("Log.create factory function", () => {
    test("creates logger with default options", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = Log.create()

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[app] INFO:", "test message")

      setEnv("NODE_ENV", originalEnv)
    })

    test("creates logger with custom options", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = Log.create({ service: "factory-test" })

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[factory-test] INFO:", "test message")

      setEnv("NODE_ENV", originalEnv)
    })

    test("returns Logger instance", () => {
      const logger = Log.create()
      expect(logger).toBeInstanceOf(Log.Logger)
    })
  })

  describe("Multiple logger instances", () => {
    test("different loggers have different service names", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger1 = Log.create({ service: "service1" })
      const logger2 = Log.create({ service: "service2" })

      logger1.info("message from service1")
      logger2.info("message from service2")

      expect(mockConsole.log).toHaveBeenCalledWith("[service1] INFO:", "message from service1")
      expect(mockConsole.log).toHaveBeenCalledWith("[service2] INFO:", "message from service2")

      setEnv("NODE_ENV", originalEnv)
    })

    test("loggers are independent", () => {
      const logger1 = Log.create({ service: "service1" })

      logger1.error("error from service1")

      expect(mockConsole.error).toHaveBeenCalledWith("[service1] ERROR:", "error from service1")
      expect(mockConsole.error).toHaveBeenCalledTimes(1)
    })
  })

  describe("Edge cases and error handling", () => {
    test("handles empty messages", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = Log.create({ service: "test" })

      logger.info("")
      logger.error("")
      logger.warn("")
      logger.debug("")

      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "")
      expect(mockConsole.error).toHaveBeenCalledWith("[test] ERROR:", "")
      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "")

      setEnv("NODE_ENV", originalEnv)
    })

    test("handles null and undefined arguments", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = Log.create({ service: "test" })

      logger.info("message", null, undefined)
      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "message", null, undefined)

      setEnv("NODE_ENV", originalEnv)
    })

    test("handles complex objects", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const logger = Log.create({ service: "test" })
      const complexObj = {
        nested: { data: "value" },
        array: [1, 2, 3],
        func: () => "test",
      }

      logger.info("complex object", complexObj)
      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "complex object", complexObj)

      setEnv("NODE_ENV", originalEnv)
    })

    test("handles very long service names", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const longServiceName = "a".repeat(100)
      const logger = Log.create({ service: longServiceName })

      logger.info("test")
      expect(mockConsole.log).toHaveBeenCalledWith(`[${longServiceName}] INFO:`, "test")

      setEnv("NODE_ENV", originalEnv)
    })

    test("handles special characters in service names", () => {
      const originalEnv = getEnv("NODE_ENV")
      setEnv("NODE_ENV", "development")

      const specialService = "test-service_123!@#"
      const logger = Log.create({ service: specialService })

      logger.info("test")
      expect(mockConsole.log).toHaveBeenCalledWith(`[${specialService}] INFO:`, "test")

      setEnv("NODE_ENV", originalEnv)
    })
  })
})
