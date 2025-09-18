import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect } from '@rstest/core'
import { DirectoryCombobox } from '../../src/components/ui/directory-combobox'
import type { DirectoryEntry } from '../../src/components/ui/directory-combobox'

describe('DirectoryCombobox', () => {
  const mockDirectories: DirectoryEntry[] = [
    { path: '/Users/bytedance/dev', name: 'dev' },
    { path: '/Users/bytedance/Documents', name: 'Documents' },
    { path: '/Users/bytedance/Downloads', name: 'Downloads' },
    { path: '/Users/bytedance/.config', name: '.config' }, // Hidden directory
    { path: '/Users/bytedance/Desktop', name: 'Desktop' },
  ]

  const mockOnSelect = (path: string) => {
    console.log('Selected:', path)
  }

  describe('Basic Rendering', () => {
    it('should render with directories', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory="/Users/bytedance/dev"
          onSelect={mockOnSelect}
        />
      )
      
      const button = screen.getByRole('combobox')
      expect(button).toBeInTheDocument()
    })

    it('should show placeholder when no directory selected', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          placeholder="Select a directory..."
        />
      )
      
      const button = screen.getByRole('combobox')
      expect(button).toHaveTextContent('Select a directory...')
    })

    it('should be disabled when disabled prop is true', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          disabled={true}
        />
      )
      
      const button = screen.getByRole('combobox')
      expect(button).toBeDisabled()
    })
  })

  describe('Directory Filtering', () => {
    it('should filter out hidden directories (starting with .)', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      // Check that visible directories are shown
      expect(screen.getByText('dev')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Downloads')).toBeInTheDocument()
      expect(screen.getByText('Desktop')).toBeInTheDocument()

      // Check that hidden directory is not shown
      expect(screen.queryByText('.config')).not.toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should filter directories based on search input', async () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          searchPlaceholder="Search directories..."
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      // Find the search input
      const [searchInput] = screen.getAllByPlaceholderText('Search directories...')
      
      // Type in the search input
      fireEvent.change(searchInput, { target: { value: 'doc' } })

      // Should show matching directories
      expect(screen.getByText('Documents')).toBeInTheDocument()
      
      // Should hide non-matching directories
      expect(screen.queryByText('dev')).not.toBeInTheDocument()
      expect(screen.queryByText('Downloads')).not.toBeInTheDocument()
      expect(screen.queryByText('Desktop')).not.toBeInTheDocument()
    })

    it('should show empty message when no matches', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          emptyText="No directories found"
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const [searchInput] = screen.getAllByPlaceholderText('Search directories...')
      fireEvent.change(searchInput, { target: { value: 'xyz123' } })

      expect(screen.getByText('No directories found')).toBeInTheDocument()
    })

    it('should be case insensitive', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      const [searchInput] = screen.getAllByPlaceholderText('Search directories...')
      
      // Search with uppercase
      fireEvent.change(searchInput, { target: { value: 'DOC' } })

      // Should still find 'Documents'
      expect(screen.getByText('Documents')).toBeInTheDocument()
    })
  })

  describe('Selection', () => {
    it('should show current directory as selected', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory="/Users/bytedance/dev"
          onSelect={mockOnSelect}
        />
      )

      const button = screen.getByRole('combobox')
      expect(button).toHaveTextContent('dev')
    })

    it('should show check mark for selected directory', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory="/Users/bytedance/Documents"
          onSelect={mockOnSelect}
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      // Find the Documents item
      const listbox = screen.getByRole('listbox')
      const documentsOption = within(listbox).getByText('Documents')
      const documentsItem = documentsOption.closest('[role="option"]')
      expect(documentsItem).toBeInTheDocument()
      
      // Check mark should be visible for selected item (opacity-100)
      const checkIcon = documentsItem?.querySelector('.lucide-check')
      expect(checkIcon).toHaveClass('opacity-100')
    })
  })

  describe('Custom Props', () => {
    it('should use custom placeholder text', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          placeholder="Choose folder..."
        />
      )

      expect(screen.getByRole('combobox')).toHaveTextContent('Choose folder...')
    })

    it('should use custom empty text', () => {
      render(
        <DirectoryCombobox
          directories={[]}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          emptyText="No folders available"
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      expect(screen.getByText('No folders available')).toBeInTheDocument()
    })

    it('should use custom search placeholder', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          searchPlaceholder="Type to filter..."
        />
      )

      const button = screen.getByRole('combobox')
      fireEvent.click(button)

      expect(screen.getByPlaceholderText('Type to filter...')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(
        <DirectoryCombobox
          directories={mockDirectories}
          currentDirectory={undefined}
          onSelect={mockOnSelect}
          className="custom-class"
        />
      )

      const button = screen.getByRole('combobox')
      expect(button).toHaveClass('custom-class')
    })
  })
})
