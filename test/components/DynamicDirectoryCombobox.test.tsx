import { describe, it, expect } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { DynamicDirectoryCombobox } from "../../src/components/ui/dynamic-directory-combobox"

const noop = () => {}

// Minimal sanity checks without exercising Radix internals to keep the suite warning-free.
describe("DynamicDirectoryCombobox", () => {
  it("renders the provided placeholder", () => {
    render(
      <DynamicDirectoryCombobox
        currentDirectory="/Users/bytedance"
        onSelect={noop}
        fetchDirectories={async () => []}
        placeholder="Select or search directories..."
      />
    )

    expect(screen.getByRole("combobox")).toHaveTextContent("Select or search directories...")
  })
})
