declare module "@xterm/addon-webgl" {
  import type { Terminal } from "@xterm/xterm"
  export class WebglAddon {
    constructor()
    activate(terminal: Terminal): void
    dispose(): void
  }
}
