// Simple logging utility for the app package
export namespace Log {
  type Level = 'silent' | 'error' | 'warn' | 'info' | 'debug'

  const levelOrder: Record<Level, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  }

  const envLevel = (() => {
    const v = (process.env.LOG_LEVEL || process.env.OPENCODE_LOG_LEVEL || '').toLowerCase()
    if (v === 'silent' || v === 'error' || v === 'warn' || v === 'info' || v === 'debug') return v as Level
    return 'info' as Level
  })()
  export interface LogOptions {
    service?: string
  }

  export class Logger {
    private service: string

    constructor(options: LogOptions = {}) {
      this.service = options.service || "app"
    }

    info(message: string, ...args: any[]) {
      if (process.env.NODE_ENV === 'test') return
      if (levelOrder[envLevel] >= levelOrder.info) {
        console.log(`[${this.service}] INFO:`, message, ...args)
      }
    }

    error(message: string, ...args: any[]) {
      if (levelOrder[envLevel] >= levelOrder.error) {
        console.error(`[${this.service}] ERROR:`, message, ...args)
      }
    }

    warn(message: string, ...args: any[]) {
      if (process.env.NODE_ENV === 'test') return
      if (levelOrder[envLevel] >= levelOrder.warn) {
        console.warn(`[${this.service}] WARN:`, message, ...args)
      }
    }

    debug(message: string, ...args: any[]) {
      if (levelOrder[envLevel] >= levelOrder.debug || process.env.DEBUG) {
        console.debug(`[${this.service}] DEBUG:`, message, ...args)
      }
    }
  }

  export function create(options: LogOptions = {}): Logger {
    return new Logger(options)
  }
}
