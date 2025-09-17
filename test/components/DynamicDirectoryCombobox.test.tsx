import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, rstest } from '@rstest/core'
import { DynamicDirectoryCombobox } from '../../src/components/ui/dynamic-directory-combobox'
import type { DirectoryEntry } from '../../src/components/ui/dynamic-directory-combobox'

const vi = rstest

// Mock directory structures for testing
const mockDirectories: Record<string, DirectoryEntry[]> = {
  '/Users/bytedance': [
    { path: '/Users/bytedance/dev', name: 'dev' },
    { path: '/Users/bytedance/Documents', name: 'Documents' },
    { path: '/Users/bytedance/Downloads', name: 'Downloads' },
    { path: '/Users/bytedance/.config', name: '.config' }, // Hidden directory
    { path: '/Users/bytedance/Desktop', name: 'Desktop' },
  ],
  '/Users/bytedance/dev': [
    { path: '/Users/bytedance/dev/opencode', name: 'opencode' },
    { path: '/Users/bytedance/dev/opencode-1', name: 'opencode-1' },
    { path: '/Users/bytedance/dev/crystal', name: 'crystal' },
    { path: '/Users/bytedance/dev/codex', name: 'codex' },
    { path: '/Users/bytedance/dev/.git', name: '.git' }, // Hidden directory
    { path: '/Users/bytedance/dev/node_modules', name: 'node_modules' }, // Should be filtered
  ],
  '/Users/bytedance/dev/opencode': [
    { path: '/Users/bytedance/dev/opencode/src', name: 'src' },
    { path: '/Users/bytedance/dev/opencode/test', name: 'test' },
    { path: '/Users/bytedance/dev/opencode/docs', name: 'docs' },
    { path: '/Users/bytedance/dev/opencode/dist', name: 'dist' }, // Should be filtered
  ],
  '/Users/bytedance/Documents': [
    { path: '/Users/bytedance/Documents/Projects', name: 'Projects' },
    { path: '/Users/bytedance/Documents/Work', name: 'Work' },
  ],
}

describe('DynamicDirectoryCombobox', () => {
  const mockOnSelect = vi.fn()
  const mockFetchDirectories = vi.fn(async (path: string): Promise<DirectoryEntry[]> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10))
    return mockDirectories[path] || []
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )
      
      const button = screen.getByRole('combobox')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Select or search directories...')
    })

    it('should render with custom placeholder', () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
          placeholder="Choose a folder"
        />
      )
      
      expect(screen.getByRole('combobox')).toHaveTextContent('Choose a folder')
    })

    it('should be disabled when disabled prop is true', () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
          disabled={true}
        />
      )
      
      expect(screen.getByRole('combobox')).toBeDisabled()
    })
  })

  describe('Opening and Initial Load', () => {
    it('should load and display current directory contents when opened', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      await waitFor(() => {
        // Should show visible directories only (not .config)
        expect(screen.getByText('dev')).toBeInTheDocument()
        expect(screen.getByText('Documents')).toBeInTheDocument()
        expect(screen.getByText('Downloads')).toBeInTheDocument()
        expect(screen.getByText('Desktop')).toBeInTheDocument()
      })

      // Hidden directories should not be shown
      expect(screen.queryByText('.config')).not.toBeInTheDocument()
      
      // Verify fetchDirectories was called
      expect(mockFetchDirectories).toHaveBeenCalledWith('/Users/bytedance')
    })

    it('should maintain results when input is focused', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('dev')).toBeInTheDocument()
      })

      // Focus on search input
      const input = screen.getByRole('combobox', { name: /suggestions/i })
      fireEvent.focus(input)

      // Results should still be visible
      expect(screen.getByText('dev')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should filter directories based on search term', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const input = await screen.findByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
      
      // Type "dev" to search
      await act(async () => {
        fireEvent.change(input, { target: { value: 'dev' } })
        vi.advanceTimersByTime(150) // Wait for debounce
      })

      await waitFor(() => {
        expect(screen.getByText('dev')).toBeInTheDocument()
        // Should also show children of matching directories
        expect(mockFetchDirectories).toHaveBeenCalledWith('/Users/bytedance/dev')
      })
    })

    it('should support path-like search (e.g., "dev/open")', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const input = await screen.findByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
      
      // Type "dev/open" to search for opencode in dev
      await act(async () => {
        fireEvent.change(input, { target: { value: 'dev/open' } })
        vi.advanceTimersByTime(150) // Wait for debounce
      })

      await waitFor(() => {
        // Should find opencode and opencode-1 in dev
        expect(screen.getByText('opencode')).toBeInTheDocument()
        expect(screen.getByText('opencode-1')).toBeInTheDocument()
        // Should show parent context
        expect(screen.getByText('in dev')).toBeInTheDocument()
      })
    })

    it('should search two levels deep', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const input = await screen.findByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
      
      // Search for "src" which is nested in dev/opencode
      await act(async () => {
        fireEvent.change(input, { target: { value: 'src' } })
        vi.advanceTimersByTime(150)
      })

      await waitFor(() => {
        expect(mockFetchDirectories).toHaveBeenCalledWith('/Users/bytedance/dev')
        expect(mockFetchDirectories).toHaveBeenCalledWith('/Users/bytedance/dev/opencode')
      })
    })

    it('should filter out hidden directories', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance/dev"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      await waitFor(() => {
        // Visible directories should be shown
        expect(screen.getByText('opencode')).toBeInTheDocument()
        expect(screen.getByText('crystal')).toBeInTheDocument()
        
        // Hidden directory should not be shown
        expect(screen.queryByText('.git')).not.toBeInTheDocument()
      })
    })

    it('should handle empty search results', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
          emptyText="No folders found"
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const input = await screen.findByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
      
      // Search for non-existent directory
      await act(async () => {
        fireEvent.change(input, { target: { value: 'nonexistent' } })
        vi.advanceTimersByTime(150)
      })

      await waitFor(() => {
        expect(screen.getByText('No folders found')).toBeInTheDocument()
      })
    })
  })

  describe('Selection', () => {
    it('should call onSelect when a directory is selected', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('dev')).toBeInTheDocument()
      })

      // Click on dev directory
      fireEvent.click(screen.getByText('dev'))

      expect(mockOnSelect).toHaveBeenCalledWith('/Users/bytedance/dev')
    })

    it('should close the popover after selection', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('dev')).toBeInTheDocument()
      })

      // Click on dev directory
      fireEvent.click(screen.getByText('dev'))

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByText('Documents')).not.toBeInTheDocument()
      })
    })

    it('should clear search after selection', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const input = await screen.findByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
      
      // Type something
      await act(async () => {
        fireEvent.change(input, { target: { value: 'dev' } })
        vi.advanceTimersByTime(150)
      })

      await waitFor(() => {
        expect(screen.getByText('dev')).toBeInTheDocument()
      })

      // Select dev
      fireEvent.click(screen.getByText('dev'))

      // Re-open and check search is cleared
      fireEvent.click(button)
      
      const newInput = await screen.findByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
      expect(newInput).toHaveValue('')
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator while fetching', async () => {
      const slowFetch = vi.fn(async (path: string): Promise<DirectoryEntry[]> => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return mockDirectories[path] || []
      })

      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={slowFetch}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      // Should show loading text
      expect(screen.getByText('Searching directories...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.queryByText('Searching directories...')).not.toBeInTheDocument()
        expect(screen.getByText('dev')).toBeInTheDocument()
      })
    })
  })

  describe('Caching', () => {
    it('should cache directory results', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('dev')).toBeInTheDocument()
      })

      expect(mockFetchDirectories).toHaveBeenCalledTimes(1)
      
      // Close and reopen
      fireEvent.click(button) // Close
      fireEvent.click(button) // Open again

      await waitFor(() => {
        expect(screen.getByText('dev')).toBeInTheDocument()
      })

      // Should not fetch again due to cache
      expect(mockFetchDirectories).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const errorFetch = vi.fn().mockRejectedValue(new Error('Network error'))

      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance"
          onSelect={mockOnSelect}
          fetchDirectories={errorFetch}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      await waitFor(() => {
        // Should show empty state on error
        expect(screen.getByText('No directories found. Start typing to search...')).toBeInTheDocument()
      })
    })
  })

  describe('Parent Directory Search', () => {
    it('should search parent directory when few results', async () => {
      render(
        <DynamicDirectoryCombobox
          currentDirectory="/Users/bytedance/Documents"
          onSelect={mockOnSelect}
          fetchDirectories={mockFetchDirectories}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const input = await screen.findByPlaceholderText("Type to search (e.g. 'dev', 'projects')...")
      
      // Search for something that would be in parent
      await act(async () => {
        fireEvent.change(input, { target: { value: 'dev' } })
        vi.advanceTimersByTime(150)
      })

      await waitFor(() => {
        // Should also search parent directory
        expect(mockFetchDirectories).toHaveBeenCalledWith('/Users/bytedance')
      })
    })
  })
})