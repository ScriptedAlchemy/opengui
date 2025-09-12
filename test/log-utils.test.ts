import { describe, test, expect, beforeEach, afterEach, rstest } from "@rstest/core"
import { Log } from "../src/util/log"

describe("Log Utilities", () => {
  let originalConsole: typeof console
  let mockConsole: {
    log: ReturnType<typeof mock>
    error: ReturnType<typeof mock>
    warn: ReturnType<typeof mock>
    debug: ReturnType<typeof mock>
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
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = new Log.Logger()

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[app] INFO:", "test message")

      process.env.NODE_ENV = originalEnv
    })

    test("creates logger with custom service name", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = new Log.Logger({ service: "custom-service" })

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[custom-service] INFO:", "test message")

      process.env.NODE_ENV = originalEnv
    })

    test("logs info messages with additional arguments", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = new Log.Logger({ service: "test" })
      const data = { key: "value" }

      logger.info("message with data", data, 123)
      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "message with data", data, 123)

      process.env.NODE_ENV = originalEnv
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
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = new Log.Logger({ service: "test" })

      logger.warn("warning message")
      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "warning message")

      process.env.NODE_ENV = originalEnv
    })

    test("logs warn messages with additional arguments", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = new Log.Logger({ service: "test" })

      logger.warn("warning", "additional", "data")
      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "warning", "additional", "data")

      process.env.NODE_ENV = originalEnv
    })

    test("logs debug messages when DEBUG is set", () => {
      const originalDebug = process.env.DEBUG
      process.env.DEBUG = "true"

      const logger = new Log.Logger({ service: "test" })
      logger.debug("debug message")

      expect(mockConsole.debug).toHaveBeenCalledWith("[test] DEBUG:", "debug message")

      process.env.DEBUG = originalDebug
    })

    test("does not log debug messages when DEBUG is not set", () => {
      const originalDebug = process.env.DEBUG
      delete process.env.DEBUG

      const logger = new Log.Logger({ service: "test" })
      logger.debug("debug message")

      expect(mockConsole.debug).not.toHaveBeenCalled()

      process.env.DEBUG = originalDebug
    })
  })

  describe("Environment-based behavior", () => {
    test("does not log info messages in test environment", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "test"

      const logger = new Log.Logger({ service: "test" })
      logger.info("test message")

      expect(mockConsole.log).not.toHaveBeenCalled()

      process.env.NODE_ENV = originalEnv
    })

    test("does not log warn messages in test environment", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "test"

      const logger = new Log.Logger({ service: "test" })
      logger.warn("warning message")

      expect(mockConsole.warn).not.toHaveBeenCalled()

      process.env.NODE_ENV = originalEnv
    })

    test("always logs error messages regardless of environment", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "test"

      const logger = new Log.Logger({ service: "test" })
      logger.error("error message")

      expect(mockConsole.error).toHaveBeenCalledWith("[test] ERROR:", "error message")

      process.env.NODE_ENV = originalEnv
    })

    test("logs info messages in non-test environment", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = new Log.Logger({ service: "test" })
      logger.info("info message")

      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "info message")

      process.env.NODE_ENV = originalEnv
    })

    test("logs warn messages in non-test environment", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "production"

      const logger = new Log.Logger({ service: "test" })
      logger.warn("warning message")

      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "warning message")

      process.env.NODE_ENV = originalEnv
    })
  })

  describe("Log.create factory function", () => {
    test("creates logger with default options", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = Log.create()

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[app] INFO:", "test message")

      process.env.NODE_ENV = originalEnv
    })

    test("creates logger with custom options", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = Log.create({ service: "factory-test" })

      logger.info("test message")
      expect(mockConsole.log).toHaveBeenCalledWith("[factory-test] INFO:", "test message")

      process.env.NODE_ENV = originalEnv
    })

    test("returns Logger instance", () => {
      const logger = Log.create()
      expect(logger).toBeInstanceOf(Log.Logger)
    })
  })

  describe("Multiple logger instances", () => {
    test("different loggers have different service names", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger1 = Log.create({ service: "service1" })
      const logger2 = Log.create({ service: "service2" })

      logger1.info("message from service1")
      logger2.info("message from service2")

      expect(mockConsole.log).toHaveBeenCalledWith("[service1] INFO:", "message from service1")
      expect(mockConsole.log).toHaveBeenCalledWith("[service2] INFO:", "message from service2")

      process.env.NODE_ENV = originalEnv
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
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = Log.create({ service: "test" })

      logger.info("")
      logger.error("")
      logger.warn("")
      logger.debug("")

      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "")
      expect(mockConsole.error).toHaveBeenCalledWith("[test] ERROR:", "")
      expect(mockConsole.warn).toHaveBeenCalledWith("[test] WARN:", "")

      process.env.NODE_ENV = originalEnv
    })

    test("handles null and undefined arguments", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = Log.create({ service: "test" })

      logger.info("message", null, undefined)
      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "message", null, undefined)

      process.env.NODE_ENV = originalEnv
    })

    test("handles complex objects", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const logger = Log.create({ service: "test" })
      const complexObj = {
        nested: { data: "value" },
        array: [1, 2, 3],
        func: () => "test",
      }

      logger.info("complex object", complexObj)
      expect(mockConsole.log).toHaveBeenCalledWith("[test] INFO:", "complex object", complexObj)

      process.env.NODE_ENV = originalEnv
    })

    test("handles very long service names", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const longServiceName = "a".repeat(100)
      const logger = Log.create({ service: longServiceName })

      logger.info("test")
      expect(mockConsole.log).toHaveBeenCalledWith(`[${longServiceName}] INFO:`, "test")

      process.env.NODE_ENV = originalEnv
    })

    test("handles special characters in service names", () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const specialService = "test-service_123!@#"
      const logger = Log.create({ service: specialService })

      logger.info("test")
      expect(mockConsole.log).toHaveBeenCalledWith(`[${specialService}] INFO:`, "test")

      process.env.NODE_ENV = originalEnv
    })
  })
})
