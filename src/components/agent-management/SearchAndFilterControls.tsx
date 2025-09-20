import { Search, Filter, Download, Upload, Plus, Sparkles } from "lucide-react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface SearchAndFilterControlsProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filterCategory: string
  onFilterChange: (category: string) => void
  sortBy: "name" | "created" | "used"
  onSortChange: (sort: "name" | "created" | "used") => void
  onCreateAgent: () => void
  onShowTemplates: () => void
  onExport: () => void
  onImport: () => void
}

export function SearchAndFilterControls({
  searchQuery,
  onSearchChange,
  filterCategory,
  onFilterChange,
  sortBy,
  onSortChange,
  onCreateAgent,
  onShowTemplates,
  onExport,
  onImport,
}: SearchAndFilterControlsProps) {
  return (
    <div className="border-b border-[#262626] p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold" data-testid="agents-page-title">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#3b82f6]">
              <span className="text-sm font-bold text-white">AI</span>
            </div>
            Agent Management
          </h1>
          <p className="mt-1 text-gray-400">Create and manage AI agents for your project</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onShowTemplates}
            className="border-[#262626] bg-[#1a1a1a] hover:bg-[#2a2a2a]"
            data-testid="templates-button"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="border-[#262626] bg-[#1a1a1a] hover:bg-[#2a2a2a]"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onImport}
            className="border-[#262626] bg-[#1a1a1a] hover:bg-[#2a2a2a]"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={onCreateAgent} className="bg-[#3b82f6] hover:bg-[#2563eb]" data-testid="create-agent-button">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mt-6 flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => {
              // Ensure change events update parent state in tests and runtime
              onSearchChange(e.target.value)
            }}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value
              if (v !== searchQuery) onSearchChange(v)
            }}
            className="h-9 border-[#262626] bg-[#1a1a1a] pl-10 placeholder:text-gray-300"
            data-testid="agents-search-input"
          />
        </div>
        <Select value={filterCategory} onValueChange={onFilterChange}>
          <SelectTrigger
            className="h-9 w-40 border-[#262626] bg-[#1a1a1a]"
            data-testid="agents-filter-button"
            aria-label="Filter agents"
          >
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent className="border-[#262626] bg-[#1a1a1a]">
            <SelectItem value="all">All Agents</SelectItem>
            <SelectItem value="builtin">Built-in</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger
            className="h-9 w-44 border-[#262626] bg-[#1a1a1a]"
            data-testid="agents-sort-button"
            aria-label="Sort agents"
          >
            <span className="mr-1 text-muted-foreground">Sort:</span>
            <SelectValue placeholder="Name" />
          </SelectTrigger>
          <SelectContent className="border-[#262626] bg-[#1a1a1a]" role="menu">
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="used">Last Used</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
