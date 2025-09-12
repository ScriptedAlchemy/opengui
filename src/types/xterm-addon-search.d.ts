declare module "xterm-addon-search" {
  import type { Terminal } from "xterm"
  export class SearchAddon {
    activate(terminal: Terminal): void
    dispose(): void
    findNext(term: string, options?: { caseSensitive?: boolean; regex?: boolean; wholeWord?: boolean }): boolean
    findPrevious(term: string, options?: { caseSensitive?: boolean; regex?: boolean; wholeWord?: boolean }): boolean
    clearDecorations(): void
  }
}

