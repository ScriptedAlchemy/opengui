declare module "xterm-addon-fit" {
  import type { Terminal } from "xterm"
  export class FitAddon {
    activate(terminal: Terminal): void
    dispose(): void
    fit(): void
  }
}
