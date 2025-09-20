export type LogLevel = "error" | "warn" | "info" | "debug"

interface LogDetails {
  context?: Record<string, unknown>
  sensitive?: Record<string, unknown>
  error?: unknown
}

interface Logger {
  info(message: string, details?: LogDetails): void
  warn(message: string, details?: LogDetails): void
  error(message: string, details?: LogDetails): void
  debug(message: string, details?: LogDetails): void
}

const levelWeight: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

type GlobalEnvironment = {
  __APP_ENV__?: string
}

const getEnvironment = (): string => {
  const processEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined
  if (typeof processEnv === "string" && processEnv.length > 0) {
    return processEnv
  }

  const globalEnv =
    typeof globalThis !== "undefined"
      ? (globalThis as GlobalEnvironment).__APP_ENV__
      : undefined

  if (typeof globalEnv === "string" && globalEnv.length > 0) {
    return globalEnv
  }

  return "development"
}

const environment = getEnvironment()
const isProduction = environment === "production"
const minimumLevel: LogLevel = isProduction ? "warn" : "debug"

const sanitizeSensitive = (values?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!values || Object.keys(values).length === 0) {
    return undefined
  }

  if (!isProduction) {
    return values
  }

  return Object.fromEntries(
    Object.keys(values).map((key) => [key, "[REDACTED]"])
  )
}

const formatDetails = (details?: LogDetails): unknown[] => {
  if (!details) {
    return []
  }

  const parts: unknown[] = []

  if (details.context && Object.keys(details.context).length > 0) {
    parts.push(details.context)
  }

  const safeSensitive = sanitizeSensitive(details.sensitive)
  if (safeSensitive) {
    parts.push({ sensitive: safeSensitive })
  }

  if (details.error !== undefined) {
    const { error } = details
    if (error instanceof Error) {
      parts.push(error)
    } else {
      parts.push({ error })
    }
  }

  return parts
}

const consoleMethod: Record<LogLevel, "error" | "warn" | "info" | "debug"> = {
  error: "error",
  warn: "warn",
  info: "info",
  debug: "debug",
}

export const createLogger = (namespace: string): Logger => {
  const prefix = `[${namespace}]`

  const shouldLog = (level: LogLevel): boolean => {
    return levelWeight[level] <= levelWeight[minimumLevel]
  }

  const log = (level: LogLevel, message: string, details?: LogDetails) => {
    if (!shouldLog(level)) {
      return
    }

    const method = consoleMethod[level]
    const formattedDetails = formatDetails(details)
    console[method](`${prefix} ${level.toUpperCase()}:`, message, ...formattedDetails)
  }

  return {
    info(message, details) {
      log("info", message, details)
    },
    warn(message, details) {
      log("warn", message, details)
    },
    error(message, details) {
      log("error", message, details)
    },
    debug(message, details) {
      log("debug", message, details)
    },
  }
}
