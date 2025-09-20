import { GitHubCliClient } from "./gh-cli"

/**
 * Create a GitHub CLI client for server-side usage.
 * A fresh instance avoids cross-request token leakage.
 */
export function createServerGitHubClient(token?: string) {
  return new GitHubCliClient({
    token,
  })
}

export type { GitHubCliClient } from "./gh-cli"
export {
  GhCliError,
  GhNotInstalledError,
  GhNotAuthenticatedError,
} from "./gh-cli"
