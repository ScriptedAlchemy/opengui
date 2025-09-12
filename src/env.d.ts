/// <reference types="@rsbuild/core/types" />

// Additional type declarations for the project
declare module "*.svg" {
  import type { FunctionComponent, SVGProps } from "react"
  const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>
  export { ReactComponent }
  const content: string
  export default content
}

declare module "*.module.css" {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module "*.module.scss" {
  const classes: { readonly [key: string]: string }
  export default classes
}