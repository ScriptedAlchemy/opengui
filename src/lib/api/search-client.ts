/**
 * Search API Client
 *
 * Client implementation for the search API endpoints.
 */

import type {
  SearchQuery,
  SearchResults,
  SearchSuggestions,
  RecentSearchesResponse,
  SearchApiClient,
} from "./search-types"

/**
 * Search API client implementation
 */
export class SearchClient implements SearchApiClient {
  private baseUrl: string

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl
  }

  /**
   * Perform a search across projects
   */
  async search(params: SearchQuery): Promise<SearchResults> {
    const queryParams = new URLSearchParams({
      q: params.q,
      type: params.type || "all",
      limit: String(params.limit || 20),
      offset: String(params.offset || 0),
    })

    if (params.projectId) {
      queryParams.set("projectId", params.projectId)
    }

    const response = await fetch(`${this.baseUrl}/api/search?${queryParams}`)

    if (!response.ok) {
      // Enhanced error logging for HTTP failures
      const responseText = await response.text().catch(() => 'Unable to read response body')
      const responseHeaders = Object.fromEntries(response.headers.entries())
      const errorDetails = {
        method: 'GET',
        url: `${this.baseUrl}/api/search?${queryParams}`,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText
      }
      console.error('Search API request failed:', errorDetails)
      throw new Error(`Search failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(
    query: string,
    projectId?: string,
    limit: number = 5
  ): Promise<SearchSuggestions> {
    const queryParams = new URLSearchParams({
      q: query,
      limit: String(limit),
    })

    if (projectId) {
      queryParams.set("projectId", projectId)
    }

    const response = await fetch(`${this.baseUrl}/api/search/suggestions?${queryParams}`)

    if (!response.ok) {
      // Enhanced error logging for HTTP failures
      const responseText = await response.text().catch(() => 'Unable to read response body')
      const responseHeaders = Object.fromEntries(response.headers.entries())
      const errorDetails = {
        method: 'GET',
        url: `${this.baseUrl}/api/search/suggestions?${queryParams}`,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText
      }
      console.error('Search suggestions API request failed:', errorDetails)
      throw new Error(`Failed to get suggestions: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get recent searches
   */
  async getRecentSearches(projectId?: string, limit: number = 10): Promise<RecentSearchesResponse> {
    const queryParams = new URLSearchParams({
      limit: String(limit),
    })

    if (projectId) {
      queryParams.set("projectId", projectId)
    }

    const response = await fetch(`${this.baseUrl}/api/search/recent?${queryParams}`)

    if (!response.ok) {
      // Enhanced error logging for HTTP failures
      const responseText = await response.text().catch(() => 'Unable to read response body')
      const responseHeaders = Object.fromEntries(response.headers.entries())
      const errorDetails = {
        method: 'GET',
        url: `${this.baseUrl}/api/search/recent?${queryParams}`,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText
      }
      console.error('Recent searches API request failed:', errorDetails)
      throw new Error(`Failed to get recent searches: ${response.statusText}`)
    }

    return response.json()
  }
}

/**
 * Default search client instance
 */
export const searchClient = new SearchClient()
