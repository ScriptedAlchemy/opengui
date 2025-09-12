declare module "xterm-addon-web-links" {
  import type { Terminal } from "xterm"
  export class WebLinksAddon {
    constructor(handler?: (event: MouseEvent, uri: string) => void)
    activate(terminal: Terminal): void
    dispose(): void
  }
}

