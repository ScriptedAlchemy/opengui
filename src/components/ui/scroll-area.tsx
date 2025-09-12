import React, { forwardRef } from "react"
import { cn } from "../../lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal"
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = "vertical", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-auto",
          orientation === "vertical" && "h-full",
          orientation === "horizontal" && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

const ScrollBar = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: "vertical" | "horizontal" }
>(({ className, orientation = "vertical", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-border absolute rounded-full transition-colors",
        orientation === "vertical" && "top-0 right-1 h-full w-1.5 hover:w-2",
        orientation === "horizontal" && "bottom-1 left-0 h-1.5 w-full hover:h-2",
        className
      )}
      {...props}
    />
  )
})
ScrollBar.displayName = "ScrollBar"

export { ScrollArea, ScrollBar }
