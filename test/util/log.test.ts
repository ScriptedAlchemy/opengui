import { describe, test, expect, beforeEach, afterAll } from "@rstest/core"
import { Log } from "../../src/util/log"

describe("Log", () => {
  const origLog = console.log
  const origWarn = console.warn
  const origErr = console.error
  const calls: { log: any[]; warn: any[]; err: any[]; dbg: any[] } = { log: [], warn: [], err: [], dbg: [] }

  beforeEach(() => {
    calls.log = []; calls.warn = []; calls.err = []; calls.dbg = []
    console.log = (...a: any[]) => { calls.log.push(a) }
    console.warn = (...a: any[]) => { calls.warn.push(a) }
    console.error = (...a: any[]) => { calls.err.push(a) }
    console.debug = (...a: any[]) => { calls.dbg.push(a) }
    process.env.NODE_ENV = "test"
    delete process.env.DEBUG
  })

  test("suppresses info/warn in test, still logs error", () => {
    const l = Log.create({ service: "svc" })
    l.info("i")
    l.warn("w")
    l.error("e")
    expect(calls.log.length).toBe(0)
    expect(calls.warn.length).toBe(0)
    expect(calls.err.length).toBe(1)
  })

  test("debug logs when DEBUG is set", () => {
    process.env.DEBUG = "1"
    const l = Log.create({ service: "svc" })
    l.debug("d")
    expect(calls.dbg.length).toBe(1)
  })

  // Restore to avoid polluting other tests
  afterAll(() => {
    console.log = origLog
    console.warn = origWarn
    console.error = origErr
  })
})
