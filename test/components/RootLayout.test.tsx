import { describe, test, expect } from "@rstest/core"
import React from "react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

import { render, fireEvent } from "@testing-library/react"
import { RootLayout } from "../../src/components/layout/RootLayout"

const Boom = (() => {
  throw new Error("Kaboom")
}) as () => JSX.Element

describe("RootLayout + ErrorBoundary", () => {
  test("renders outlet children", () => {
    const { getByText } = render(
      <MemoryRouter 
        initialEntries={["/"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<div>child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(getByText("child")).toBeDefined()
  })

  test("shows fallback on error and can reset", () => {
    const { getByText } = render(
      <MemoryRouter 
        initialEntries={["/"]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route element={<RootLayout />}>
            <Route index element={<Boom />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(getByText("Something went wrong")).toBeDefined()
    const btn = getByText("Try again")
    fireEvent.click(btn)
    expect(getByText("Something went wrong")).toBeDefined()
  })
})
