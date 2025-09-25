import { describe, test, expect, beforeEach, afterAll } from "@rstest/core"
import { Log } from "../../src/util/log"


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
    setEnv("NODE_ENV", "test")
    setEnv("DEBUG", undefined)
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
    setEnv("DEBUG", "1")
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
