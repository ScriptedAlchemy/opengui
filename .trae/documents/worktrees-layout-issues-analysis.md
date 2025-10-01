# Worktrees Layout Issues Analysis

## Overview
This document analyzes the layout problems observed in the Worktrees interface based on visual inspection of the UI screenshots and code examination.

## Identified Layout Issues

### 1. Text Truncation in Worktree Cards

**Problem Description:**
- Long worktree titles and paths are being truncated with ellipsis (...)
- Branch names like "container-json-parse" are cut off mid-word
- File paths like "/Users/b..." are severely truncated, making them unreadable
- The "Relative:" path information is also truncated (e.g., "worktrees/next-rsc")

**Location in Code:**
- File: `src/features/worktrees/WorktreeBoard.tsx`
- Lines: 218-225 (CardContent section)
- Specific issue: `<div className="truncate">{worktree.path}</div>`

**Root Cause:**
- The CSS class `truncate` is applied to path elements, which adds `text-overflow: ellipsis`
- Fixed card width in the grid layout doesn't accommodate varying content lengths
- No responsive text sizing or wrapping strategy for long paths

### 2. Inconsistent Card Spacing and Layout

**Problem Description:**
- Cards appear to have inconsistent spacing between elements
- The grid layout (`md:grid-cols-2 xl:grid-cols-3`) may not be optimal for the content density
- Action buttons (play and trash icons) are cramped in the card header

**Location in Code:**
- File: `src/features/worktrees/WorktreeBoard.tsx`
- Lines: 179-181 (Grid container)
- Code: `<div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">`

**Root Cause:**
- Fixed grid columns don't adapt well to varying content lengths
- Gap spacing of `gap-3` (12px) may be insufficient for readability
- Card content density is high relative to available space

### 3. Sheet Width Constraints

**Problem Description:**
- The worktrees sheet has a fixed width of 560px
- This constraint forces content truncation rather than allowing natural text flow
- On larger screens, this width limitation is unnecessary

**Location in Code:**
- File: `src/pages/OperationsHub.tsx`
- Line: 89
- Code: `<SheetContent side="left" className="w-[560px] p-0" data-testid="worktrees-sheet">`

**Root Cause:**
- Hard-coded width value doesn't scale with screen size or content needs
- No responsive width strategy for different viewport sizes

### 4. Card Header Layout Issues

**Problem Description:**
- Card titles with icons and action buttons compete for limited horizontal space
- The `justify-between` layout pushes action buttons to the far right, creating awkward spacing
- Button group spacing could be improved

**Location in Code:**
- File: `src/features/worktrees/WorktreeBoard.tsx`
- Lines: 184-186 (CardHeader)
- Code: `<CardHeader className="flex flex-row items-center justify-between space-y-0">`

**Root Cause:**
- `justify-between` creates maximum separation between title and actions
- No consideration for title length vs. available space
- Action button group lacks proper spacing classes

### 5. Content Hierarchy and Information Architecture

**Problem Description:**
- Important information (full paths, branch names) is hidden due to truncation
- No clear visual hierarchy between primary (title) and secondary (path, branch) information
- Relative path information may be redundant or could be presented more efficiently

**Location in Code:**
- File: `src/features/worktrees/WorktreeBoard.tsx`
- Lines: 218-225 (CardContent)

**Root Cause:**
- All text content treated with same importance level
- No progressive disclosure or tooltip strategy for truncated content
- Information density not optimized for the available space

## Technical Context

### Component Structure
- **WorktreeBoard** component renders within a Sheet overlay
- Uses **shadcn/ui Card** components with Tailwind CSS classes
- Grid layout with responsive breakpoints
- ScrollArea wrapper for overflow handling

### Layout Constraints
- Sheet width: 560px (fixed)
- Grid: 2 columns on md+, 3 columns on xl+
- Card padding: 4 (16px)
- Gap between cards: 3 (12px)

## Impact Assessment

**Usability Issues:**
- Users cannot read full worktree paths or titles
- Difficult to distinguish between similar worktrees
- Poor information scannability

**Visual Design Issues:**
- Inconsistent spacing creates visual noise
- Truncated text appears unfinished/broken
- Layout doesn't scale well across different content lengths

## Affected Files Summary

1. **Primary:** `src/features/worktrees/WorktreeBoard.tsx` (main layout logic)
2. **Secondary:** `src/pages/OperationsHub.tsx` (sheet container constraints)
3. **Styling:** Tailwind CSS classes throughout both components

This analysis provides the foundation for implementing layout improvements while maintaining the existing component architecture and design system consistency.