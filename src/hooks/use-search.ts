/**
 * useSearch Hook
 *
 * React hook for search functionality.
 */

import { useState, useCallback, useEffect } from "react"
import { searchClient } from "../lib/api/search-client"
import type {
  SearchQuery,
  SearchResultItem,
  SearchSuggestionItem,
  RecentSearchItem,
} from "../lib/api/search-types"

export interface UseSearchOptions {
  projectId?: string
  debounceMs?: number
  autoSuggest?: boolean
}

export interface UseSearchReturn {
  // State
  query: string
  results: SearchResultItem[]
  suggestions: SearchSuggestionItem[]
  recentSearches: RecentSearchItem[]
  isLoading: boolean
  error: string | null

  // Pagination
  total: number
  limit: number
  offset: number
  hasMore: boolean

  // Actions
  setQuery: (query: string) => void
  search: (params?: Partial<SearchQuery>) => Promise<void>
  loadMore: () => Promise<void>
  clearResults: () => void
  loadSuggestions: (query: string) => Promise<void>
  loadRecentSearches: () => Promise<void>
}

/**
 * Hook for search functionality
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { projectId, debounceMs = 300, autoSuggest = true } = options

  // State
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([])
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pagination state
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)

  const hasMore = offset + limit < total

  // Debounce timer
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  /**
   * Perform search
   */
  const search = useCallback(
    async (params: Partial<SearchQuery> = {}) => {
      if (!query && !params.q) {
        setError("Search query is required")
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const searchParams: SearchQuery = {
          q: params.q || query,
          projectId: params.projectId || projectId,
          type: params.type || "all",
          limit: params.limit || limit,
          offset: params.offset || 0,
        }

        const response = await searchClient.search(searchParams)

        if (params.offset && params.offset > 0) {
          // Append results for pagination
          setResults((prev) => [...prev, ...response.results])
        } else {
          // Replace results for new search
          setResults(response.results)
        }

        setTotal(response.total)
        setLimit(response.limit)
        setOffset(response.offset)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed"
        setError(message)
        console.error("Search error:", err)
      } finally {
        setIsLoading(false)
      }
    },
    [query, projectId, limit]
  )

  /**
   * Load more results (pagination)
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return

    await search({
      offset: offset + limit,
    })
  }, [search, offset, limit, hasMore, isLoading])

  /**
   * Load search suggestions
   */
  const loadSuggestions = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery) {
        setSuggestions([])
        return
      }

      try {
        const response = await searchClient.getSuggestions(searchQuery, projectId, 5)
        setSuggestions(response.suggestions)
      } catch (err) {
        console.error("Failed to load suggestions:", err)
        setSuggestions([])
      }
    },
    [projectId]
  )

  /**
   * Load recent searches
   */
  const loadRecentSearches = useCallback(async () => {
    try {
      const response = await searchClient.getRecentSearches(projectId, 10)
      setRecentSearches(response.searches)
    } catch (err) {
      console.error("Failed to load recent searches:", err)
      setRecentSearches([])
    }
  }, [projectId])

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setResults([])
    setTotal(0)
    setOffset(0)
    setError(null)
  }, [])

  /**
   * Handle query change with debouncing
   */
  const handleSetQuery = useCallback(
    (newQuery: string) => {
      setQuery(newQuery)

      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // Set new timer for auto-suggest
      if (autoSuggest && newQuery) {
        const timer = setTimeout(() => {
          loadSuggestions(newQuery)
        }, debounceMs)
        setDebounceTimer(timer)
      } else {
        setSuggestions([])
      }
    },
    [autoSuggest, debounceMs, debounceTimer, loadSuggestions]
  )

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches()
  }, [loadRecentSearches])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [debounceTimer])

  return {
    // State
    query,
    results,
    suggestions,
    recentSearches,
    isLoading,
    error,

    // Pagination
    total,
    limit,
    offset,
    hasMore,

    // Actions
    setQuery: handleSetQuery,
    search,
    loadMore,
    clearResults,
    loadSuggestions,
    loadRecentSearches,
  }
}
