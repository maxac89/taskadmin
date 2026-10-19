# Technical Specification — Task Management CRUD Application

| | |
|---|---|
| **Document** | `specs/start/spec.md` |
| **Status** | Draft |
| **Branch** | `feature/taskadmin-technical-spec` |
| **Source** | `specs/start/taskadmin.feature` (Gherkin behavior spec) |
| **Version** | 2.0 — 2026-10-19 |

---

## 1. Overview

### 1.1 Purpose
This document defines the technical design for the **Task Management CRUD** application: a simple, fully client-side web app for creating, viewing, updating, and deleting tasks. It translates the behavioral requirements in `taskadmin.feature` into a concrete architecture, data model, storage design, and UI specification.

### 1.2 Scope
In scope: task list ("My Tasks" dashboard), task detail view, task create/edit form, status filtering, delete confirmation flow, and all validation/error paths covered by the feature file.

Out of scope: backend/API, database, multi-user accounts, synchronization, task sharing, attachments, notifications.

### 1.3 Reference stack

| Layer | Choice | Notes |
|---|---|---|
| Markup | Plain **HTML5** | Static files; opens directly in the browser or via any static server |
| Styling | Plain **CSS3** | No framework; one stylesheet + CSS variables for theming |
| Logic | **Vanilla JavaScript** (ES modules) | No build step, no dependencies, no framework |
| Persistence | **`localStorage`** | Browser-local storage; JSON-serialized data |
| Server / API | **None** | All logic runs in the browser |

Everything works by opening `index.html` in a browser. A static file server (e.g. `npx serve`) is optional for development only.

---

## 2. Architecture

### 2.1 High-level

```
┌────────────────────────────────────────────────┐
│                    Browser                      │
│                                                 │
│  index.html ──▶ app.js (controller)             │
│       │             │                           │
│       │        ┌────┴─────────────────┐         │
│       │        ▼                      ▼         │
│       │   storage.js             views.js       │
│       │   (localStorage I/O)     (render/DOM)   │
│       │        │                      │         │
│       │        ▼                      ▼         │
│       │   model.js (validation, ids, helpers)   │
│       │                                          │
│       └──▶ styles.css                            │
└────────────────────────────────────────────────┘
                       │
                       ▼
            localStorage (per-origin)
            key: "tasks" → JSON array
```

### 2.2 Files

```
/
├── index.html          # Single page: list, detail, and form views
├── styles.css          # All styling
└── js/
    ├── app.js          # Entry point: state, routing, event wiring
    ├── model.js        # Task factory, validation, enum labels, helpers
    ├── storage.js      # load/save/delete via localStorage
    └── views.js        # DOM rendering for list, detail, form, messages
```

### 2.3 Data flow
1. On load, `app.js` reads all tasks from `storage.js` and renders the list.
2. User actions (click, submit) dispatch to a controller function in `app.js`.
3. The controller calls `model.js` for validation; on failure, the view shows an inline error and **no storage write occurs**.
4. On success, `storage.js` persists the change, then the list re-renders.
5. A success message (toast/flash) is displayed with the exact wording from the feature file.

> **SPA "routing"** = switching which section of `index.html` is visible (list / detail / form). Query-string or hash routing (`#/tasks/:id`) is optional; state can also be held in a JS variable with the previous view kept in memory for "back" behavior.

---

## 3. Data Model & Persistence

### 3.1 Entity: `Task`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | generated | Unique id — `crypto.randomUUID()` (or `"t" + Date.now() + random`) |
| `title` | string | **yes** | — | Non-empty after trimming; max 200 chars |
| `description` | string | no | `""` | Free text; empty string allowed |
| `status` | enum | no | `"To Do"` | `"To Do"` \| `"In Progress"` \| `"Done"` |
| `priority` | enum | no | `"Medium"` | `"Low"` \| `"Medium"` \| `"High"` |
| `dueDate` | string | no | `""` | ISO date `YYYY-MM-DD`; empty if unset |
| `completedAt` | string \| null | auto | `null` | ISO timestamp; set when status becomes `"Done"` |
| `createdAt` | string | auto | now (ISO) | Used for list ordering (newest first) |
| `updatedAt` | string | auto | now (ISO) | Refreshed on every edit |

Enum values are stored as **display labels** directly (the same strings the feature file asserts), so no mapping layer is needed.

### 3.2 `localStorage` layout

| Key | Value |
|---|---|
| `tasks` | `JSON.stringify(Task[])` |
| `tasks.nextId` *(optional)* | counter, only if sequential ids are preferred over UUIDs |

Rules:
- Reads/writes happen **only** through `storage.js` (`loadTasks`, `saveTasks`, `getTask`, `addTask`, `updateTask`, `deleteTask`).
- Every mutation re-serializes the full array and writes it in one `setItem` call — effectively an all-or-nothing save.
- Storage errors are caught: `QuotaExceededError` → message *"Storage is full — the task could not be saved."*; disabled storage (private mode) → warn on startup and keep data in memory for the session.

### 3.3 Status "state machine"

```
   ┌──────────┐   update   ┌───────────────┐   update   ┌──────────┐
   │  To Do   │ ─────────▶ │ In Progress   │ ─────────▶ │   Done   │
   │          │ ◀───────── │               │ ◀───────── │          │
   └──────────┘   update   └───────────────┘   update   └──────────┘
```
- All transitions are legal in any direction.
- Entering `"Done"` → set `completedAt = new Date().toISOString()`.
- Leaving `"Done"` → reset `completedAt = null`.

### 3.4 Seed / demo data (optional)
On first run (no `tasks` key), `app.js` may seed the three tasks from the feature file's data table ("Book dentist", "Prepare Q3 report", "Water the plants") for demo purposes. A "Clear all data" helper resets the store.

---

## 4. Validation Rules

Validation lives in `model.js` and runs on form submit (client-side only — there is no server). Messages are the exact strings asserted in the feature file.

| # | Field | Rule | Error message (exact string) | Feature scenario |
|---|---|---|---|---|
| V1 | `title` | Required; non-empty **after trimming** | `Title is required` | Create/update with empty title rejected |
| V2 | `title` | ≤ 200 chars | `Title must be 200 characters or fewer` | (defensive) |
| V3 | `description` | ≤ 5,000 chars | `Description must be 5000 characters or fewer` | (defensive) |
| V4 | `status` | One of the three labels | `Invalid status value` | Filter, status change |
| V5 | `priority` | One of the three labels | `Invalid priority value` | Create/update forms |
| V6 | `dueDate` | Empty or a valid ISO date; not before today on create | `Due date must be a valid date` / `Due date cannot be in the past` | Create w/ due date |
| V7 | `id` | Must exist in the store | `Task not found` | All `@notfound` scenarios |

**Key invariants (from the feature file):**
- A rejected create/update performs **no write** — the stored array is unchanged and the original title (and all fields) remain intact.
- A "Task not found" state is shown whenever a requested id doesn't exist (e.g. stale hash URL like `#/tasks/9999`).
- Duplicate titles are **allowed** (preconditions like "user has no task named X" are setup state, not business rules).

---

## 5. CRUD Operations (module contracts)

No API — each operation is a JS function. Signatures below are the contract between modules.

### 5.1 Create — `addTask(data) → Task`
```js
const task = addTask({
  title: "Book dentist appointment",
  description: "Call the clinic to schedule a checkup",
  dueDate: "2026-10-30",
  priority: "High"          // default "Medium"
});
```
- Validates (V1–V6); throws `ValidationError("Title is required")` if invalid.
- Assigns `id`, `status: "To Do"`, `completedAt: null`, `createdAt`/`updatedAt` = now.
- Prepends to the array, persists, returns the new task.
- UI then shows: **Task created successfully**.

### 5.2 Read — list & detail
```js
const tasks = loadTasks();                       // list, stored order = newest first
const visible = filterByStatus(tasks, "Done");   // status filter
const task   = getTask(id);                      // → Task | undefined → "Task not found"
```
- **List order:** newest first. Because `addTask` prepends, order is insertion-independent of storage; the list sorts by `createdAt` descending as a safety net.
- **Filter:** a `<select>` with `All` / `To Do` / `In Progress` / `Done`; choosing a value re-renders showing only matching tasks.

### 5.3 Update — `updateTask(id, changes) → Task`
```js
const task = updateTask(id, { title: "Buy groceries and cook dinner",
                              description: "Milk, eggs, pasta, and tomatoes" });
updateTask(id, { status: "Done" });   // also sets completedAt
```
- Validates the **merged** result; on failure nothing is written and the original values persist.
- Applies `completedAt` side effects per §3.3; refreshes `updatedAt`.
- Task not found → throws `NotFoundError("Task not found")`.
- UI then shows: **Task updated successfully**.

### 5.4 Delete — `deleteTask(id) → boolean`
```js
deleteTask(id);   // → true if removed; false if id not found
```
- Only called after the user confirms in the modal (§6.4); cancelling never calls it.
- Removes the task, persists, shows: **Task deleted successfully**.
- Deleting a non-existent id (stale state) → *"Task not found"* and no change.

---

## 6. UI Specification

### 6.1 Layout (single `index.html`)
One page with three switchable sections:

| Section | Trigger | Contents |
|---|---|---|
| **Task list** ("My Tasks" dashboard) | App start; after save/cancel | Header, "New Task" button, status filter, task cards/rows (title, status badge, priority badge, due date), empty-state text |
| **Task detail** | Clicking a task in the list (or hash URL) | All task fields, "Edit" and "Delete" buttons, "Back to list" link |
| **Create / edit form** | "New Task" or "Edit" | Fields: title (required), description (textarea), status, priority, due date; "Save" and "Cancel" buttons |

### 6.2 Task list behavior
- Sorted by `createdAt` descending — **most recently created task appears first**.
- Status filter shows only matching tasks; selecting "Done" hides "To Do"/"In Progress" tasks.
- Newly created tasks appear at the top immediately after save.
- Empty state: *"No tasks yet — create one to get started."*

### 6.3 Feedback messages (exact strings from the feature file)
| Trigger | Message | Presentation |
|---|---|---|
| Successful create | `Task created successfully` | Toast/flash, auto-dismiss after ~3 s |
| Successful update | `Task updated successfully` | Toast/flash |
| Successful delete | `Task deleted successfully` | Toast/flash |
| Validation failure | `Title is required` (or field-specific) | Inline error under the field + form alert; form keeps all entered values |

### 6.4 Delete confirmation flow
1. User clicks **Delete** on the detail view.
2. Modal: *"Are you sure you want to delete this task?"* with **Confirm** and **Cancel** buttons (native `<dialog>` or a custom overlay).
3. **Confirm** → `deleteTask(id)` → return to list, show `Task deleted successfully`.
4. **Cancel** → modal closes, nothing is called or changed.

### 6.5 Form validation UX
- On submit: trim inputs → validate via `model.js`.
- Invalid → show inline errors (e.g. *"Title is required"* under the title input), keep all entered values, do not persist.
- Valid → persist → show success toast → return to list.

### 6.6 Not-found handling
- Direct/stale URL such as `#/tasks/9999` → detail section shows **"Task not found"** with a link back to the list (matches all `@notfound` scenarios).

---

## 7. Accessibility & Responsiveness

- Semantic HTML: `<main>`, `<section>`, `<form>`, `<label for=…>`, real `<button>` elements.
- Keyboard operable: Tab order follows the flow; Enter submits the form; Escape closes the delete modal; focus moves to the modal on open and returns on close.
- Modal uses `role="dialog" aria-modal="true"` with `aria-labelledby`; errors linked to inputs via `aria-describedby` and `aria-invalid`.
- Status/priority conveyed by text labels (not color alone).
- Mobile-first CSS: single-column layout, filter and buttons wrap; touch targets ≥ 44 px.

---

## 8. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Dependencies | Zero — plain HTML/CSS/JS, no npm packages, no build step |
| Performance | Instant interactions; 1,000+ tasks render without noticeable lag (virtualize or paginate if needed) |
| Data size | Comfortably handles the `localStorage` ~5 MB budget; JSON payload per task is small |
| Integrity | Full-array atomic writes (§3.2) — a failed save leaves previous data intact |
| Portability | Runs from `file://` or any static host; no server required |
| Browser support | Modern evergreen browsers (Chrome, Firefox, Edge, Safari) |
| Data lifecycle | Data persists per browser/origin; a "Clear all tasks" action resets the store |
| Compatibility | `taskadmin.feature` is the acceptance baseline; behavior changes update the feature file first |

---

## 9. Traceability Matrix — Feature Scenario → Design Elements

| # | Scenario (feature file) | Tag(s) | Design elements |
|---|---|---|---|
| 1 | Create a new task with a title and description | `@create` | §3.1, §5.1, form §6.1, toast "Task created successfully" §6.3 |
| 2 | Create a new task with only a required title | `@create` | Defaults `description: ""`, `priority: "Medium"`, `status: "To Do"` (§3.1, §5.1) |
| 3 | Create a task without a title is rejected | `@create @validation` | V1, inline error, no write (§4, §6.5) |
| 4 | View an existing task's details | `@view` | `getTask(id)` §5.2, detail view §6.1 |
| 5 | View the list sorted by creation date | `@view` | `createdAt DESC` ordering §5.2, §6.2 |
| 6 | Filter tasks by status | `@view @filter` | `filterByStatus` §5.2, filter control §6.2 |
| 7 | View a task that does not exist | `@view @notfound` | "Task not found" state §4 V7, §6.6 |
| 8 | Update an existing task's title and description | `@update` | `updateTask` §5.3, toast "Task updated successfully" §6.3 |
| 9 | Change a task's status to done | `@update` | State machine + `completedAt` §3.3, §5.3 |
| 10 | Update a task with an empty title is rejected | `@update @validation` | V1, all-or-nothing save, original values intact (§4, §5.3) |
| 11 | Update a task that does not exist | `@update @notfound` | `NotFoundError` §5.3, no-write guarantee §4 |
| 12 | Delete an existing task | `@delete` | `deleteTask` §5.4, confirm modal §6.4, toast §6.3 |
| 13 | Cancel deleting a task | `@delete @cancel` | Modal cancel → no call, data intact §6.4 |
| 14 | Delete a task that does not exist | `@delete @notfound` | Not-found path §5.4, §6.6 |
| 15 | Complete task lifecycle create → update → delete | `@lifecycle` | Full flow: §5.1 → §5.3 (status ×2) → §5.4, empty list §6.2 |

---

## 10. Milestones

| Phase | Deliverable |
|---|---|
| M1 — Foundation | `index.html` skeleton, `styles.css` theme, `model.js` + `storage.js` |
| M2 — CRUD | Create, list, detail, edit, delete flows wired in `app.js`; toasts and inline validation |
| M3 — Polish | Filter, delete modal, not-found state, accessibility pass, mobile layout |
| M4 — Acceptance | E2E suite green against `taskadmin.feature`; seed/demo data and "clear data" helper |

---

## 11. Open Questions

1. Hash-based routing (`#/tasks/:id`) vs. purely in-memory view state? (Affects deep links and the `@notfound` scenario only.)
2. Should duplicate titles be prevented per the UI even though the spec currently allows them?
3. Seed demo data on first run, or start empty? (Scenario 15 starts from an empty store.)
4. "Clear all data" button — useful for demos, but easy to mis-click; include or not?
