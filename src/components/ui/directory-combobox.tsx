"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Folder } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DirectoryEntry {
  path: string
  name: string
}

interface DirectoryComboboxProps {
  directories: DirectoryEntry[]
  currentDirectory?: string
  onSelect: (directory: string) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
}

export function DirectoryCombobox({
  directories,
  currentDirectory,
  onSelect,
  placeholder = "Select directory...",
  emptyText = "No directories found.",
  searchPlaceholder = "Search directories...",
  className,
  disabled = false,
}: DirectoryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filteredDirectories = React.useMemo(() => {
    // Filter out hidden directories (starting with .)
    const visibleDirectories = directories.filter((dir) => !dir.name.startsWith('.'))
    
    if (!search) return visibleDirectories
    return visibleDirectories.filter((dir) =>
      dir.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [directories, search])

  const selectedDir = directories.find((dir) => dir.path === currentDirectory)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !currentDirectory && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 truncate">
            <Folder className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {selectedDir ? selectedDir.name : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredDirectories.map((directory) => (
                <CommandItem
                  key={directory.path}
                  value={directory.path}
                  onSelect={() => {
                    onSelect(directory.path)
                    setOpen(false)
                    setSearch("")
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="truncate" title={directory.path}>
                      {directory.name}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      currentDirectory === directory.path ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}