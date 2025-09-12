declare module "xterm" {
  export interface TerminalOptions {
    cursorBlink?: boolean
    scrollback?: number
    fontFamily?: string
    theme?: {
      background?: string
      foreground?: string
      cursor?: string
    }
  }

  export interface ITerminalAddon {
    activate(terminal: Terminal): void
    dispose(): void
  }

  export class Terminal {
    constructor(options?: TerminalOptions)
    open(container: HTMLElement): void
    write(data: string | Uint8Array): void
    dispose(): void
    clear(): void
    reset(): void
    onData(callback: (data: string) => void): { dispose(): void }
    onKey(callback: (e: { key: string; domEvent: KeyboardEvent }) => void): { dispose(): void }
    loadAddon(addon: ITerminalAddon): void
    getSelection(): string
    hasSelection(): boolean
    clearSelection(): void
    selectAll(): void
  }
}

declare module "xterm/css/xterm.css" {
  const content: string
  export default content
}
