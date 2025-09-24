// Simple logging utility for the app package
export namespace Log {
  type Level = "silent" | "error" | "warn" | "info" | "debug"

  const levelOrder: Record<Level, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  }

  const getEnv = (key: string): string | undefined => {
    const proc = Reflect.get(globalThis, "process") as
      | { env?: Record<string, string | undefined> }
      | undefined
    return proc?.env?.[key]
  }

  const envLevel = (() => {
    const v = (getEnv("LOG_LEVEL") || getEnv("OPENCODE_LOG_LEVEL") || "").toLowerCase()
    if (v === "silent" || v === "error" || v === "warn" || v === "info" || v === "debug")
      return v as Level
    return "info" as Level
  })()
  export interface LogOptions {
    service?: string
  }

  export class Logger {
    private service: string

    constructor(options: LogOptions = {}) {
      this.service = options.service || "app"
    }

    info(message: string, ...args: unknown[]) {
      if (getEnv("NODE_ENV") === "test") return
      if (levelOrder[envLevel] >= levelOrder.info) {
        console.log(`[${this.service}] INFO:`, message, ...args)
      }
    }

    error(message: string, ...args: unknown[]) {
      if (levelOrder[envLevel] >= levelOrder.error) {
        console.error(`[${this.service}] ERROR:`, message, ...args)
      }
    }

    warn(message: string, ...args: unknown[]) {
      if (getEnv("NODE_ENV") === "test") return
      if (levelOrder[envLevel] >= levelOrder.warn) {
        console.warn(`[${this.service}] WARN:`, message, ...args)
      }
    }

    debug(message: string, ...args: unknown[]) {
      if (levelOrder[envLevel] >= levelOrder.debug || getEnv("DEBUG")) {
        console.debug(`[${this.service}] DEBUG:`, message, ...args)
      }
    }
  }

  export function create(options: LogOptions = {}): Logger {
    return new Logger(options)
  }
}
