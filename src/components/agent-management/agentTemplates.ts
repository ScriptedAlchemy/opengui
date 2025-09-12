import { Code, BookOpen, TestTube, Settings, Palette, BarChart3 } from "lucide-react"
import type { AgentTemplate } from "./AgentTemplatesDialog"

export const agentTemplates: AgentTemplate[] = [
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description: "Reviews code for best practices, bugs, and improvements",
    category: "Development",
    icon: Code,
    prompt:
      "You are an expert code reviewer. Analyze code for:\n- Best practices and patterns\n- Potential bugs and security issues\n- Performance optimizations\n- Code clarity and maintainability\n\nProvide constructive feedback with specific suggestions.",
    tools: { read: true, grep: true, glob: true },
    permissions: { edit: "ask", bash: {}, webfetch: "deny" },
    mode: "subagent",
    temperature: 0.3,
    topP: 0.9,
  },
  {
    id: "documentation-writer",
    name: "Documentation Writer",
    description: "Creates comprehensive documentation for projects",
    category: "Documentation",
    icon: BookOpen,
    prompt:
      "You are a technical documentation specialist. Create clear, comprehensive documentation that includes:\n- API references\n- Usage examples\n- Best practices\n- Troubleshooting guides\n\nWrite in a clear, accessible style for developers.",
    tools: { read: true, write: true, glob: true, grep: true },
    permissions: { edit: "ask", bash: {}, webfetch: "allow" },
    mode: "subagent",
    temperature: 0.5,
    topP: 0.9,
  },
  {
    id: "test-generator",
    name: "Test Generator",
    description: "Generates comprehensive test suites for code",
    category: "Testing",
    icon: TestTube,
    prompt:
      "You are a testing expert. Generate comprehensive test suites including:\n- Unit tests\n- Integration tests\n- Edge cases\n- Mock data and fixtures\n\nFollow testing best practices and ensure good coverage.",
    tools: { read: true, write: true, bash: true, glob: true },
    permissions: {
      edit: "ask",
      bash: { "npm test": "allow", "yarn test": "allow" },
      webfetch: "deny",
    },
    mode: "subagent",
    temperature: 0.4,
    topP: 0.9,
  },
  {
    id: "devops-assistant",
    name: "DevOps Assistant",
    description: "Helps with deployment, CI/CD, and infrastructure",
    category: "DevOps",
    icon: Settings,
    prompt:
      "You are a DevOps specialist. Help with:\n- CI/CD pipeline configuration\n- Docker and containerization\n- Cloud infrastructure setup\n- Monitoring and logging\n- Security best practices\n\nProvide practical, production-ready solutions.",
    tools: { read: true, write: true, bash: true, glob: true, grep: true },
    permissions: { edit: "ask", bash: {}, webfetch: "allow" },
    mode: "subagent",
    temperature: 0.3,
    topP: 0.9,
  },
  {
    id: "ui-designer",
    name: "UI Designer",
    description: "Creates beautiful, accessible user interfaces",
    category: "Design",
    icon: Palette,
    prompt:
      "You are a UI/UX designer and frontend developer. Create:\n- Beautiful, accessible interfaces\n- Responsive designs\n- Component libraries\n- Design systems\n\nFocus on user experience and modern design principles.",
    tools: { read: true, write: true, glob: true, webfetch: true },
    permissions: { edit: "ask", bash: {}, webfetch: "allow" },
    mode: "subagent",
    temperature: 0.6,
    topP: 0.9,
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    description: "Analyzes data and creates insights",
    category: "Analytics",
    icon: BarChart3,
    prompt:
      "You are a data analyst. Help with:\n- Data exploration and analysis\n- Statistical insights\n- Data visualization\n- Report generation\n- Performance metrics\n\nProvide actionable insights from data.",
    tools: { read: true, bash: true, glob: true, grep: true, webfetch: true },
    permissions: { edit: "ask", bash: {}, webfetch: "allow" },
    mode: "subagent",
    temperature: 0.4,
    topP: 0.9,
  },
]
