/**
 * Search API Types
 *
 * TypeScript types for search functionality that can be used by both frontend and backend.
 */

/**
 * Search query parameters
 */
export interface SearchQuery {
  q: string
  projectId?: string
  type?: "all" | "files" | "code" | "agents" | "sessions"
  limit?: number
  offset?: number
}

/**
 * Search result item
 */
export interface SearchResultItem {
  id: string
  type: "file" | "code" | "agent" | "session"
  title: string
  description?: string
  path?: string
  projectId?: string
  projectName?: string
  highlights?: string[]
  metadata?: Record<string, unknown>
  score?: number
  timestamp?: string
}

/**
 * Search results response
 */
export interface SearchResults {
  query: string
  type: string
  results: SearchResultItem[]
  total: number
  limit: number
  offset: number
  took?: number
}

/**
 * Search suggestion parameters
 */
export interface SearchSuggestionQuery {
  q: string
  projectId?: string
  limit?: number
}

/**
 * Search suggestion item
 */
export interface SearchSuggestionItem {
  text: string
  type: "query" | "file" | "command" | "agent"
  icon?: string
  description?: string
}

/**
 * Search suggestions response
 */
export interface SearchSuggestions {
  query: string
  suggestions: SearchSuggestionItem[]
}

/**
 * Recent searches query parameters
 */
export interface RecentSearchesQuery {
  projectId?: string
  limit?: number
}

/**
 * Recent search item
 */
export interface RecentSearchItem {
  id: string
  query: string
  type: string
  timestamp: string
  projectId?: string
  projectName?: string
  resultCount?: number
}

/**
 * Recent searches response
 */
export interface RecentSearchesResponse {
  searches: RecentSearchItem[]
}

/**
 * Search API client interface
 */
export interface SearchApiClient {
  /**
   * Perform a search
   */
  search(params: SearchQuery): Promise<SearchResults>

  /**
   * Get search suggestions
   */
  getSuggestions(query: string, projectId?: string, limit?: number): Promise<SearchSuggestions>

  /**
   * Get recent searches
   */
  getRecentSearches(projectId?: string, limit?: number): Promise<RecentSearchesResponse>
}
