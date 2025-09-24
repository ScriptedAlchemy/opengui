import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  CircleDot,
  GitPullRequest,
  Code,
  Play,
  FolderKanban,
  BookOpen,
  RefreshCw,
  Plus,
  Search,
} from "lucide-react"

interface RepositoryHeaderTab {
  key: string
  label: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  count?: number
}

interface RepositoryHeaderProps {
  owner: string
  name: string
  private?: boolean
  activeTab: string
  onTabChange: (tab: string) => void
  onNewIssue?: () => void
  onRefresh?: () => void
  issuesCount?: number
  pullsCount?: number
  tabs?: RepositoryHeaderTab[]
  ownerAvatarUrl?: string
}

const DEFAULT_TABS: RepositoryHeaderTab[] = [
  { key: "code", label: "Code", icon: Code },
  { key: "issues", label: "Issues", icon: CircleDot },
  { key: "pulls", label: "Pull requests", icon: GitPullRequest },
  { key: "actions", label: "Actions", icon: Play },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "wiki", label: "Wiki", icon: BookOpen },
]

export function RepositoryHeader({
  owner,
  name,
  private: isPrivate,
  activeTab,
  onTabChange,
  onNewIssue,
  onRefresh,
  issuesCount,
  pullsCount,
  tabs: customTabs,
  ownerAvatarUrl,
}: RepositoryHeaderProps) {
  const tabs = (customTabs ?? DEFAULT_TABS).map((tab) => {
    if (tab.key === "issues") {
      return { ...tab, count: issuesCount }
    }
    if (tab.key === "pulls") {
      return { ...tab, count: pullsCount }
    }
    return tab
  })

  const fallbackInitials = owner?.slice(0, 2).toUpperCase() || "GH"
  const computedAvatarUrl =
    ownerAvatarUrl ?? (owner ? `https://avatars.githubusercontent.com/${owner}` : undefined)

  return (
    <div className="border-border bg-background border-b">
      <div className="flex flex-col gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={computedAvatarUrl} alt={`${owner} avatar`} />
              <AvatarFallback>{fallbackInitials}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">{owner}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground font-semibold">{name}</span>
            {isPrivate ? (
              <Badge className="ml-2 bg-purple-100 font-normal text-purple-800">Private</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-foreground hover:bg-accent hidden h-8 w-8 p-0 md:inline-flex"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            {onRefresh ? (
              <Button
                variant="outline"
                size="sm"
                className="text-foreground hover:bg-accent hidden h-8 w-8 p-0 md:inline-flex"
                onClick={onRefresh}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {onNewIssue ? (
              <Button variant="default" size="sm" onClick={onNewIssue}>
                <Plus className="mr-2 h-3.5 w-3.5" /> New issue
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon ?? CircleDot
            const isActive = activeTab === tab.key
            return (
              <Button
                key={tab.key}
                variant="ghost"
                size="sm"
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
                onClick={() => onTabChange(tab.key)}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {typeof tab.count === "number" ? (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground ml-2">
                    {tab.count}
                  </Badge>
                ) : null}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
