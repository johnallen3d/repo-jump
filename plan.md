# GitHub Quick Nav — Chrome Extension Feature Plan

## Goal
Keyboard-first way to fuzzy-search your GitHub repositories and jump directly to issues, pull requests, or other sections — without site search or extra clicks.

## Core Requirements

### 1. Know Your Repos
- Fetch and cache the user’s repositories (owned, collaborator, organization) via GitHub API.
- Support personal access token or OAuth for private repos.
- Periodic background refresh + manual refresh.
- Store locally (IndexedDB or `chrome.storage`) so search is instant and works offline after first sync.

### 2. Fuzzy Search
- Single search input (omnibox keyword or command palette).
- Fuzzy match on `owner/repo`, repo name, and optionally description.
- Ranking: exact > prefix > fuzzy; boost recently visited and frequently used repos.
- Real-time filtering as you type.

### 3. Direct Jump to Issues / PRs
- After selecting or typing a repo, support quick suffixes or secondary actions:
  - `pulls` / `prs` → `/pulls`
  - `issues` → `/issues`
  - `actions` → `/actions`
  - (optionally) `wiki`, `settings`, `projects`, specific branch, etc.
- One-shot commands such as:
  - `repo-name pulls`
  - `owner/repo issues`
- Or keyboard shortcut on the selected result (e.g. `Tab` cycles sections, `Enter` opens current section).

### 4. Keyboard-Driven
- Primary interface: omnibox keyword (e.g. `gh`) **or** global/hotkey command palette (e.g. `⌘⇧K`).
- Full keyboard navigation: arrows to move, Enter to open, Esc to close.
- No mouse required for the common path: open → type → select → land on issues or PRs.

### 5. Scope
- Focused on **your** repos first (owned + collaborator + orgs you belong to).
- Optional secondary modes: starred, recently visited (from history), or global search.
- Works on any page (omnibox) or at least on github.com (palette).

## Nice-to-Haves
- Per-repo open PR/issue counts in suggestions.
- Recently visited ranking (learn from history).
- Customizable default section (code / pulls / issues).
- Support for jumping to a specific issue/PR number (`repo #123`).
- Light/dark theme matching system or GitHub.
- Minimal permissions and local-first storage.

## Non-Goals
- Full GitHub search replacement.
- Code search inside repos.
- UI modifications to github.com pages (unless using a palette overlay).

## Technical Sketch
- Manifest V3.
- Omnibox API and/or `chrome.commands` + popup/content script palette.
- GitHub REST or GraphQL API for repo list + optional counts.
- Fuzzy library (Fuse.js or simple custom scorer).
- Local cache with background sync.

## Success Criteria
- Type a few characters of a repo name → see matching repos.
- Append or select `pulls` / `issues` → land directly on that page in one motion.
- Faster than: open GitHub → search or navigate to repo → click Issues/PRs.
