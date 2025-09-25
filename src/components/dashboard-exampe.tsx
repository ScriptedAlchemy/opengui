import type { ComponentProps, CSSProperties } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

type CSSCustomProperties = CSSProperties & Record<`--${string}`, string | number>

// Allow standard styles plus CSS custom properties.
const layoutStyles: CSSCustomProperties = {
  "--sidebar-width": "calc(var(--spacing) * 72)",
  "--header-height": "calc(var(--spacing) * 12)",
}

const data: ComponentProps<typeof DataTable>["data"] = [
  {
    id: 1,
    header: "Weekly Active Users",
    type: "Metric",
    status: "Live",
    target: "25k",
    limit: "35k",
    reviewer: "Jordan Chase",
  },
  {
    id: 2,
    header: "Homepage Conversion",
    type: "Funnel",
    status: "Review",
    target: "4.2%",
    limit: "5.0%",
    reviewer: "Samira Patel",
  },
  {
    id: 3,
    header: "Support Ticket SLA",
    type: "Operations",
    status: "At Risk",
    target: "< 12h",
    limit: "18h",
    reviewer: "Miguel Hernandez",
  },
  {
    id: 4,
    header: "Feature Adoption",
    type: "Product",
    status: "Live",
    target: "65%",
    limit: "80%",
    reviewer: "Avery Stone",
  },
  {
    id: 5,
    header: "Quarterly Pipeline",
    type: "Revenue",
    status: "Planning",
    target: "$4.5M",
    limit: "$6.0M",
    reviewer: "Casey Lin",
  },
]

export default function Page() {
  return (
    <SidebarProvider style={layoutStyles}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>
              <DataTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
