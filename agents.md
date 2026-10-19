# Agents

Environment reference for AI agents working in this repository.

## Project Description

**Task Management CRUD** — a task/to-do management application exposing the four core CRUD operations over tasks.

- **Purpose:** let authenticated users organize personal work by creating, viewing, updating, and deleting tasks.
- **Core entities:** a *Task* with `title` (required), `description`, `status` (`To Do`, `In Progress`, `Done`), `priority` (`Low`, `Medium`, `High`), `due date`, and timestamps.
- **Core behaviors:**
  - **Create** — new task via form; title is mandatory, description optional, priority defaults to `Medium`, status defaults to `To Do`.
  - **View** — list tasks (newest first) with status filtering, plus a task detail page; missing tasks return 404.
  - **Update** — edit title/description, change status and priority; empty title is rejected and changes are not applied.
  - **Delete** — remove a task after user confirmation; cancelling keeps it; deleting a missing task returns 404.
- **Specifications:** behavior is documented in Gherkin under `specs/` (e.g. `specs/start/taskadmin.feature`), tagged by operation (`@create`, `@view`, `@update`, `@delete`) and cross-cutting concerns (`@validation`, `@notfound`).

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

- **Repository:** this directory is a Git repository (initialized here), no commits yet; current branch `feature/task-management-crud` (branched from `main` for the Task Management CRUD work)
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
