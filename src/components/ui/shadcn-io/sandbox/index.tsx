"use client"

import type {
  CodeEditorProps,
  PreviewProps,
  SandpackLayoutProps,
  SandpackProviderProps,
} from "@codesandbox/sandpack-react"
import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react"
import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export type SandboxProviderProps = SandpackProviderProps

export const SandboxProvider = ({ className, ...props }: SandpackProviderProps): ReactNode => (
  <div className={cn("size-full", className)}>
    <SandpackProvider className="!size-full !max-h-none" {...props} />
  </div>
)

export type SandboxLayoutProps = SandpackLayoutProps

export const SandboxLayout = ({ className, ...props }: SandpackLayoutProps): ReactNode => (
  <SandpackLayout
    className={cn("!h-full !rounded-none !border-none !bg-transparent", className)}
    {...props}
  />
)

export type SandboxTabsContextValue = {
  selectedTab: string | undefined
  setSelectedTab: (value: string) => void
}

const SandboxTabsContext = createContext<SandboxTabsContextValue | undefined>(undefined)

const useSandboxTabsContext = () => {
  const context = useContext(SandboxTabsContext)

  if (!context) {
    throw new Error("SandboxTabs components must be used within a SandboxTabsProvider")
  }

  return context
}

export type SandboxTabsProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

export const SandboxTabs = ({
  className,
  defaultValue,
  value,
  onValueChange,
  ...props
}: SandboxTabsProps): ReactNode => {
  const [selectedTab, setSelectedTabState] = useState(value || defaultValue)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedTabState(value)
    }
  }, [value])

  const setSelectedTab = useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setSelectedTabState(newValue)
      }
      onValueChange?.(newValue)
    },
    [value, onValueChange]
  )

  return (
    <SandboxTabsContext.Provider value={{ selectedTab, setSelectedTab }}>
      <div
        className={cn(
          "group relative flex size-full flex-col overflow-hidden rounded-lg border text-sm",
          className
        )}
        {...props}
        data-selected={selectedTab}
      >
        {props.children}
      </div>
    </SandboxTabsContext.Provider>
  )
}

export type SandboxTabsListProps = HTMLAttributes<HTMLDivElement>

export const SandboxTabsList = ({ className, ...props }: SandboxTabsListProps): ReactNode => (
  <div
    className={cn(
      "bg-secondary text-muted-foreground inline-flex w-full shrink-0 items-center justify-start border-b p-2",
      className
    )}
    role="tablist"
    {...props}
  />
)

export type SandboxTabsTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  value: string
}

export const SandboxTabsTrigger = ({
  className,
  value,
  ...props
}: SandboxTabsTriggerProps): ReactNode => {
  const { selectedTab, setSelectedTab } = useSandboxTabsContext()

  const handleClick = useCallback(() => {
    setSelectedTab(value)
  }, [setSelectedTab, value])

  return (
    <button
      aria-selected={selectedTab === value}
      className={cn(
        "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow",
        className
      )}
      data-state={selectedTab === value ? "active" : "inactive"}
      onClick={handleClick}
      role="tab"
      {...props}
    />
  )
}

export type SandboxTabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string
}

export const SandboxTabsContent = ({
  className,
  value,
  ...props
}: SandboxTabsContentProps): ReactNode => {
  const { selectedTab } = useSandboxTabsContext()

  return (
    <div
      aria-hidden={selectedTab !== value}
      className={cn(
        "ring-offset-background focus-visible:ring-ring flex-1 overflow-y-auto transition-opacity duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        selectedTab === value
          ? "h-auto w-auto opacity-100"
          : "pointer-events-none absolute h-0 w-0 opacity-0",
        className
      )}
      data-state={selectedTab === value ? "active" : "inactive"}
      role="tabpanel"
      {...props}
    />
  )
}

export type SandboxCodeEditorProps = CodeEditorProps

export const SandboxCodeEditor = ({
  showTabs = false,
  ...props
}: SandboxCodeEditorProps): ReactNode => <SandpackCodeEditor showTabs={showTabs} {...props} />

export type SandboxConsoleProps = Parameters<typeof SandpackConsole>[0]

export const SandboxConsole = ({ className, ...props }: SandboxConsoleProps): ReactNode => (
  <SandpackConsole className={cn("h-full", className)} {...props} />
)

export type SandboxPreviewProps = PreviewProps & {
  className?: string
}

export const SandboxPreview = ({
  className,
  showOpenInCodeSandbox = false,
  ...props
}: SandboxPreviewProps): ReactNode => (
  <SandpackPreview
    className={cn("h-full", className)}
    showOpenInCodeSandbox={showOpenInCodeSandbox}
    {...props}
  />
)

export type SandboxFileExplorerProps = ComponentProps<typeof SandpackFileExplorer>

export const SandboxFileExplorer = ({
  autoHiddenFiles = true,
  className,
  ...props
}: SandboxFileExplorerProps): ReactNode => (
  <SandpackFileExplorer
    autoHiddenFiles={autoHiddenFiles}
    className={cn("h-full", className)}
    {...props}
  />
)
