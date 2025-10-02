import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { Folder, FolderOpen, Loader2, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DirectoryEntry {
  path: string
  name: string
}

interface SearchResult {
  path: string
  name: string
  parentPath?: string
  level: number
}

interface DirectoryPathComboboxProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DirectoryPathCombobox({ value, onValueChange, className }: DirectoryPathComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [cache, setCache] = useState<Map<string, DirectoryEntry[]>>(new Map())
  const [root, setRoot] = useState<string>("")
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch HOME directory once for suggestions baseline
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    fetch("/api/system/home", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && typeof data?.path === "string") setRoot(data.path)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const fetchDirectories = useCallback(async (path: string): Promise<DirectoryEntry[]> => {
    if (cache.has(path)) {
      return cache.get(path)!
    }

    try {
      const response = await fetch(
        `/api/system/list-directory?path=${encodeURIComponent(path)}`
      )
      if (!response.ok) return []
      const data = await response.json()
      const dirs = (data.entries || []).filter((d: DirectoryEntry) => !d.name.startsWith("."))
      setCache((prev) => new Map(prev).set(path, dirs))
      return dirs
    } catch (error) {
      console.error(`Failed to fetch directories for ${path}:`, error)
      return []
    }
  }, [cache])

  const deepSearch = useCallback(
    async (searchTerm: string, currentDir: string) => {
      setLoading(true)
      const results: SearchResult[] = []
      const visited = new Set<string>()

      // If no search term, show current directory contents
      if (!searchTerm || searchTerm.length === 0) {
        const dirs = await fetchDirectories(currentDir)
        setSearchResults(
          dirs.map((d) => ({
            path: d.path,
            name: d.name,
            level: 1,
          }))
        )
        setLoading(false)
        return
      }

      // Parse search term - support path-like searches (e.g., "dev/open")
      const searchParts = searchTerm.toLowerCase().split("/")
      const primarySearch = searchParts[0]
      const secondarySearch = searchParts[1] || ""

      // Search function that goes 2 levels deep
      const searchLevel = async (path: string, level: number, parentPath?: string) => {
        if (visited.has(path) || level > 2) return
        visited.add(path)

        const dirs = await fetchDirectories(path)

        for (const dir of dirs) {
          const nameLower = dir.name.toLowerCase()
          const pathLower = dir.path.toLowerCase()

          // For path-like searches (e.g., "dev/open")
          if (searchParts.length > 1 && level === 1) {
            if (nameLower.includes(primarySearch)) {
              const childDirs = await fetchDirectories(dir.path)
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
            // Single term search
            if (nameLower.includes(primarySearch) || pathLower.includes(primarySearch)) {
              results.push({
                path: dir.path,
                name: dir.name,
                parentPath,
                level,
              })
            }

            // Search children if we have a match at level 1
            if (level === 1 && nameLower.includes(primarySearch)) {
              await searchLevel(dir.path, level + 1, dir.path)
            }
          }
        }
      }

      // Start search from current directory
      await searchLevel(currentDir, 1)

      // Also search from parent if we have few results
      if (results.length < 5) {
        const parentPath = currentDir.substring(0, currentDir.lastIndexOf("/"))
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

      setSearchResults(results.slice(0, 20))
      setLoading(false)
    },
    [fetchDirectories]
  )

  // Debounced search
  useEffect(() => {
    if (!open) return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const base = value || root
    if (!base) return

    if (!search || search.length <= 1) {
      deepSearch(search, base)
    } else {
      searchTimeoutRef.current = setTimeout(() => {
        deepSearch(search, base)
      }, 150)
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [open, search, value, deepSearch])

  // Load initial directories when opened
  useEffect(() => {
    const base = value || root
    if (open && base && searchResults.length === 0) {
      deepSearch("", base)
    }
  }, [open, value, root])

  const formatDisplayName = (result: SearchResult) => {
    if (result.parentPath) {
      const parentName = result.parentPath.split("/").pop() || ""
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{result.name}</span>
          <span className="text-xs text-muted-foreground">in {parentName}</span>
        </div>
      )
    }
    return <span className="font-medium">{result.name}</span>
  }

  const parentPath = useMemo(() => {
    if (!value) return null
    const idx = value.lastIndexOf("/")
    if (idx <= 0) return "/"
    return value.slice(0, idx) || "/"
  }, [value])

  return (
    <div className={cn("space-y-2", className)}>
      {/* Always-visible text input to satisfy typed path flows and tests */}
      <div className="flex items-center gap-2">
        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          placeholder={"Type to search directories..."}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onValueChange((e.target as HTMLInputElement).value)
            }
          }}
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          aria-label="Browse"
          title="Browse"
          role="combobox"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </Button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type to search directories..."
              value={search}
              onValueChange={setSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const typed = (e.target as HTMLInputElement).value
                  if (typed && typed.trim()) {
                    onValueChange(typed.trim())
                    setOpen(false)
                  }
                }
              }}
            />
            <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching directories...
              </div>
            ) : searchResults.length === 0 ? (
              <CommandEmpty>No directories found. Try typing to search...</CommandEmpty>
            ) : (
              <CommandGroup>
                {/* Parent navigation when not searching */}
                {(!search || search.length === 0) && parentPath && value !== "/" && (
                  <CommandItem
                    key={`__parent__:${parentPath}`}
                    value={parentPath}
                    onSelect={() => {
                      onValueChange(parentPath)
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
                        value === parentPath ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                )}
                {searchResults.map((result) => (
                  <CommandItem
                    key={result.path}
                    value={result.path}
                    onSelect={() => {
                      onValueChange(result.path)
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
                        value === result.path ? "opacity-100" : "opacity-0"
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
    </div>
  )
}
