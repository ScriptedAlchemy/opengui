// Simple logging utility for the app package
export namespace Log {
  export interface LogOptions {
    service?: string
  }

  export class Logger {
    private service: string

    constructor(options: LogOptions = {}) {
      this.service = options.service || "app"
    }

    info(message: string, ...args: any[]) {
      if (process.env.NODE_ENV !== "test") {
        console.log(`[${this.service}] INFO:`, message, ...args)
      }
    }

    error(message: string, ...args: any[]) {
      console.error(`[${this.service}] ERROR:`, message, ...args)
    }

    warn(message: string, ...args: any[]) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(`[${this.service}] WARN:`, message, ...args)
      }
    }

    debug(message: string, ...args: any[]) {
      if (process.env.DEBUG) {
        console.debug(`[${this.service}] DEBUG:`, message, ...args)
      }
    }
  }

  export function create(options: LogOptions = {}): Logger {
    return new Logger(options)
  }
}
