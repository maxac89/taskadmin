# Agents

Environment reference for AI agents working in this repository.

## Project Description

**Task Management CRUD** — a simple, fully client-side task/to-do web app. No backend, no API, no build step, no npm dependencies, no tests.

- **Stack:** plain HTML5 + CSS3 + vanilla JavaScript (ES modules), persistence via `localStorage`. Runs directly from `file://` or any static host.
- **Source layout:**
  - `index.html` — single page (list / detail / form sections switched by JS)
  - `styles.css` — all styling, CSS variables for theming
  - `js/app.js` — entry point: state, view switching, event wiring
  - `js/model.js` — Task factory, validation, enum helpers
  - `js/storage.js` — **only** module that touches `localStorage` (key `tasks` → `JSON.stringify(Task[])`, full-array atomic writes)
  - `js/views.js` — DOM rendering

### Task model (stored as display labels — no mapping layer)

| Field | Notes |
|---|---|
| `id` | `crypto.randomUUID()` |
| `title` | **required**, non-empty after trim, ≤200 chars |
| `description` | optional, default `""` |
| `status` | `"To Do"` \| `"In Progress"` \| `"Done"`, default `"To Do"` |
| `priority` | `"Low"` \| `"Medium"` \| `"High"`, default `"Medium"` |
| `dueDate` | ISO `YYYY-MM-DD`, optional |
| `completedAt` | set when status becomes `"Done"`, cleared when it leaves |
| `createdAt` / `updatedAt` | ISO timestamps; list sorted by `createdAt` **newest first** |

### Rules agents must preserve

- Validation failure (e.g. empty title → exact message `Title is required`) performs **no write** — stored data and original field values stay intact.
- Unknown id (e.g. `#/tasks/9999`) → show **"Task not found"**; never crash.
- Duplicate titles are allowed.
- Delete requires a confirmation modal; **Cancel must not call `deleteTask`**.
- Success toasts use exact strings: `Task created successfully`, `Task updated successfully`, `Task deleted successfully`.
- All CRUD goes through module functions (`addTask`, `loadTasks`, `filterByStatus`, `getTask`, `updateTask`, `deleteTask`) — never touch `localStorage` directly outside `storage.js`.

### Documentation

- `specs/start/taskadmin.feature` — Gherkin behavior spec (15 scenarios; tags `@create`, `@view`, `@update`, `@delete`, `@validation`, `@notfound`, `@filter`, `@cancel`, `@lifecycle`).
- `specs/start/spec.md` — technical specification (architecture, data model, validation, module contracts, UI spec, traceability matrix). Keep behavior changes in sync with both files.

## Operating System

- **OS:** Alpine Linux v3.24.2 (`x86_64`)
- **Kernel:** Linux 6.18.54.1-microsoft-standard-WSL2 (WSL2)
- **Init / base utilities:** BusyBox v1.37.0 (multi-call binary)
- **Container/hostname:** `0e8402e44ec0`

## Package Manager

- **System package manager:** `apk` (apk-tools 3.0.8-r0) — `/sbin/apk`
  - Install: `apk add <package>`
  - Update index: `apk update`
  - Upgrade: `apk upgrade`
- **Other tools present:**
  - `npm` 11.12.1 / `node` v24.18.1 — `/usr/bin/npm`
  - `git` 2.54.0 — `/usr/bin/git`
  - `gh` (GitHub CLI) 2.97.0 — `/usr/bin/gh` (authenticated as `maxac89`)
- **Not available:** apt, dnf, yum, pacman, zypper, emerge, brew, nix

## Shell Terminals

- **Default shell:** `/bin/sh` → BusyBox `ash` (`$SHELL` is unset)
- **Available:**
  - `bash` 5.3.9 — `/bin/bash`
  - `sh` / `ash` (BusyBox), plus BusyBox applets (`vi`, `awk`, `sed`, `grep`, `top`, etc.)
- **Not installed:** zsh, fish, dash, ksh, tcsh, csh, nu, elvish

## Version Control

- **Repository:** this directory is a Git repository (initialized here); current branch `feature/taskadmin-technical-spec`; branches: `main`, `feature/task-management-crud` (feature spec + project doc), `feature/taskadmin-technical-spec` (technical spec)
- **Git identity (local to this repo):**
  - `user.name` = `maxac89`
  - `user.email` = `max89or@gmail.com`
- **GitHub CLI:** `gh` 2.97.0 is authenticated as **`maxac89`** (token scopes: `gist`, `read:org`, `repo`, `workflow`), git protocol HTTPS. Re-auth is interactive (`gh auth login`) — don't attempt it via scripts.

## Notes for agents

- Bash is installed, so bashisms (`[[ ]]`, arrays, `source`, process substitution) are fine when using `#!/bin/bash` or `bash script.sh`.
- Scripts using `#!/bin/sh` must stay POSIX-compatible — `/bin/sh` is BusyBox `ash`, not bash.
- BusyBox `ps`, `grep`, `sed`, etc. have a reduced feature set compared to GNU coreutils.
- Prefer `apk add` for installing system packages; `sudo` may not be available — commands may already run as root.
- **Shell commands require approval:** a global OpenCode permission (`{ "action": "shell", "resource": "*", "effect": "ask" }` in `~/.config/opencode/opencode.jsonc`) prompts before every shell command. Batch independent commands into a single call when possible.
