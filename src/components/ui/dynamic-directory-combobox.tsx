"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Folder, FolderOpen, Loader2 } from "lucide-react"
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

interface SearchResult {
  path: string
  name: string
  parentPath?: string
  level: number
}

interface DynamicDirectoryComboboxProps {
  currentDirectory: string
  onSelect: (directory: string) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  debounceDelay?: number
  // Function to fetch subdirectories for a given path
  fetchDirectories: (path: string) => Promise<DirectoryEntry[]>
  // Show a quick item to navigate to parent directory when possible
  showParentOption?: boolean
}

export function DynamicDirectoryCombobox({
  currentDirectory,
  onSelect,
  placeholder = "Select or search directories...",
  emptyText = "No directories found. Try typing to search...",
  searchPlaceholder = "Type to search directories (e.g. 'dev', 'projects')...",
  className,
  disabled = false,
  debounceDelay = 150,
  fetchDirectories,
  showParentOption = true,
}: DynamicDirectoryComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [cache, setCache] = React.useState<Map<string, DirectoryEntry[]>>(new Map())
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()

  // Fetch and cache directories for a path
  const getCachedOrFetch = React.useCallback(async (path: string): Promise<DirectoryEntry[]> => {
    if (cache.has(path)) {
      return cache.get(path)!
    }
    
    try {
      const dirs = await fetchDirectories(path)
      const visibleDirs = dirs.filter(d => !d.name.startsWith('.'))
      setCache(prev => new Map(prev).set(path, visibleDirs))
      return visibleDirs
    } catch (error) {
      console.error(`Failed to fetch directories for ${path}:`, error)
      return []
    }
  }, [cache, fetchDirectories])

  // Deep search function
  const deepSearch = React.useCallback(async (searchTerm: string) => {
    setLoading(true)
    const results: SearchResult[] = []
    const visited = new Set<string>()
    
    // If no search term, show current directory contents
    if (!searchTerm || searchTerm.length === 0) {
      const dirs = await getCachedOrFetch(currentDirectory)
      setSearchResults(dirs.map(d => ({
        path: d.path,
        name: d.name,
        level: 1
      })))
      setLoading(false)
      return
    }

    // Parse search term - support path-like searches (e.g., "dev/open")
    const searchParts = searchTerm.toLowerCase().split('/')
    const primarySearch = searchParts[0]
    const secondarySearch = searchParts[1] || ''
    
    // Search function that goes 2 levels deep
    const searchLevel = async (path: string, level: number, parentPath?: string) => {
      if (visited.has(path) || level > 2) return
      visited.add(path)
      
      const dirs = await getCachedOrFetch(path)
      
      // Check current level directories
      for (const dir of dirs) {
        const nameLower = dir.name.toLowerCase()
        const pathLower = dir.path.toLowerCase()
        
        // For path-like searches (e.g., "dev/open")
        if (searchParts.length > 1 && level === 1) {
          // First part should match current level
          if (nameLower.includes(primarySearch)) {
            // Search children for second part
            const childDirs = await getCachedOrFetch(dir.path)
            for (const childDir of childDirs) {
              if (childDir.name.toLowerCase().includes(secondarySearch)) {
                results.push({
                  path: childDir.path,
                  name: childDir.name,
                  parentPath: dir.path,
                  level: 2,
                })
              }
            }
          }
        } else {
          // Single term search - match on name or path
          if (nameLower.includes(primarySearch) || pathLower.includes(primarySearch)) {
            results.push({
              path: dir.path,
              name: dir.name,
              parentPath,
              level,
            })
          }
          
          // If we're at level 1 and have a match, also search children
          if (level === 1 && nameLower.includes(primarySearch)) {
            await searchLevel(dir.path, level + 1, dir.path)
          }
        }
      }
    }
    
    // Start search from current directory and go 2 levels deep
    await searchLevel(currentDirectory, 1)
    
    // Also search from parent directory if we have few results
    if (results.length < 5) {
      const parentPath = currentDirectory.substring(0, currentDirectory.lastIndexOf('/'))
      if (parentPath && parentPath.length > 1) {
        await searchLevel(parentPath, 1)
      }
    }
    
    // Sort results: exact matches first, then by level, then alphabetically
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === primarySearch
      const bExact = b.name.toLowerCase() === primarySearch
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      if (a.level !== b.level) return a.level - b.level
      return a.name.localeCompare(b.name)
    })
    
    setSearchResults(results.slice(0, 20)) // Limit to 20 results
    setLoading(false)
  }, [currentDirectory, getCachedOrFetch])

  // Compute parent path (POSIX-style). For Windows, server returns POSIX paths.
  const parentPath = React.useMemo(() => {
    if (!currentDirectory) return null
    const idx = currentDirectory.lastIndexOf('/')
    if (idx <= 0) return '/'
    return currentDirectory.slice(0, idx) || '/'
  }, [currentDirectory])

  // Debounced search - reduce delay for better responsiveness
  React.useEffect(() => {
    if (!open) return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Immediate search for empty or very short terms
    if (!search || search.length <= 1) {
      deepSearch(search)
    } else {
      searchTimeoutRef.current = setTimeout(() => {
        deepSearch(search)
      }, debounceDelay)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [open, search, deepSearch, debounceDelay])

  // Load initial directories when opened (only once)
  React.useEffect(() => {
    if (open && searchResults.length === 0) {
      deepSearch('')
    }
  }, [open, deepSearch, searchResults.length])

  // Format display name with path context
  const formatDisplayName = (result: SearchResult) => {
    if (result.parentPath) {
      const parentName = result.parentPath.split('/').pop() || ''
      // For search results like "dev/opencode", show as "opencode (in dev)"
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{result.name}</span>
          <span className="text-xs text-muted-foreground">
            in {parentName}
          </span>
        </div>
      )
    }
    return <span className="font-medium">{result.name}</span>
  }

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
              {placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching directories...
              </div>
            ) : searchResults.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {/* Optional parent navigation when not searching */}
                {showParentOption && (!search || search.length === 0) && parentPath && currentDirectory !== '/' && (
                  <CommandItem
                    key={`__parent__:${parentPath}`}
                    value={parentPath}
                    onSelect={() => {
                      onSelect(parentPath)
                      setOpen(false)
                      setSearch("")
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={parentPath}>
                        Parent: {parentPath}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        currentDirectory === parentPath ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                )}
                {searchResults.map((result) => (
                  <CommandItem
                    key={result.path}
                    value={result.path}
                    onSelect={() => {
                      onSelect(result.path)
                      setOpen(false)
                      setSearch("")
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {result.level > 1 ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Folder className="h-4 w-4 shrink-0" />
                      )}
                      {formatDisplayName(result)}
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        currentDirectory === result.path ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
