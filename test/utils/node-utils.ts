import { spawn, exec } from 'child_process'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Node.js replacement for Bun.sleep()
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Node.js replacement for Bun.spawn()
 */
export function spawnProcess(command: string[], options?: {
  cwd?: string
  env?: Record<string, string>
  stdio?: 'inherit' | 'pipe' | 'ignore'
}): Promise<{ exitCode: number; stdout?: string; stderr?: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env },
      stdio: options?.stdio || 'pipe'
    })

    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout: stdout || undefined,
        stderr: stderr || undefined
      })
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Node.js replacement for Bun.spawn() with advanced options
 */
export function spawnAdvanced(options: {
  cmd: string[]
  env?: Record<string, string>
  cwd?: string
  stdout?: 'pipe' | 'inherit' | 'ignore'
  stderr?: 'pipe' | 'inherit' | 'ignore'
  stdin?: 'pipe' | 'inherit' | 'ignore'
  onExit?: (subprocess: any, exitCode: number | null, signalCode: string | null, error?: Error) => void
}) {
  const child = spawn(options.cmd[0], options.cmd.slice(1), {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: [
      options.stdin || 'ignore',
      options.stdout || 'pipe',
      options.stderr || 'pipe'
    ]
  })

  if (options.onExit) {
    child.on('close', (code, signal) => {
      options.onExit!(child, code, signal, undefined)
    })

    child.on('error', (error) => {
      options.onExit!(child, null, null, error)
    })
  }

  const exitedPromise = new Promise<void>((resolve) => {
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })

  return {
    stdout: child.stdout,
    stderr: child.stderr,
    stdin: child.stdin,
    kill: (signal?: NodeJS.Signals) => {
      if (child.killed) return false
      child.kill(signal)
      return true
    },
    pid: child.pid,
    exited: exitedPromise
  }
}

/**
 * Node.js replacement for Bun.$`` template literal commands
 */
// Support both forms: $("cmd", options?) and $`cmd ${expr}`
export async function $(
  ...args:
    | [command: string, options?: { cwd?: string; env?: Record<string, string> }]
    | [strings: TemplateStringsArray, ...expr: unknown[]]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let command: string
  let options: { cwd?: string; env?: Record<string, string> } | undefined
  if (Array.isArray(args[0])) {
    const strings = args[0] as TemplateStringsArray
    const expr = args.slice(1)
    command = strings.reduce((acc, s, i) => acc + s + (i < expr.length ? String(expr[i]) : ''), '')
    options = undefined // options not supported in tagged form
  } else {
    command = args[0] as string
    options = (args[1] as { cwd?: string; env?: Record<string, string> }) || undefined
  }
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env }
    })
    return { exitCode: 0, stdout: stdout || '', stderr: stderr || '' }
  } catch (error: any) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    }
  }
}

/**
 * Node.js replacement for Bun.hash()
 */
export function hash(input: string, algorithm: string = 'sha256'): string {
  return createHash(algorithm).update(input).digest('hex')
}

/**
 * Node.js replacement for Bun.file() operations
 */
export const file = {
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  },

  async text(path: string): Promise<string> {
    return fs.readFile(path, 'utf-8')
  },

  async write(path: string, content: string): Promise<void> {
    return fs.writeFile(path, content, 'utf-8')
  },

  async json(path: string): Promise<any> {
    const content = await fs.readFile(path, 'utf-8')
    return JSON.parse(content)
  }
}

/**
 * Node.js replacement for Bun.serve() - simplified for port finding
 */
export function serve(options: { port: number; fetch: () => Response }): { port: number; stop: () => void } {
  const http = require('http')
  
  const server = http.createServer((_req: any, res: any) => {
    options.fetch()
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
  })
  
  if (options.port === 0) {
    server.listen(0)
    const actualPort = server.address()?.port || 0
    return {
      port: actualPort,
      stop: () => server.close()
    }
  } else {
    server.listen(options.port)
    return {
      port: options.port,
      stop: () => server.close()
    }
  }
}
