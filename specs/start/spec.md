# Technical Specification — Task Management CRUD Application

| | |
|---|---|
| **Document** | `specs/start/spec.md` |
| **Status** | Draft |
| **Branch** | `feature/taskadmin-technical-spec` |
| **Source** | `specs/start/taskadmin.feature` (Gherkin behavior spec) |
| **Version** | 1.0 — 2026-10-19 |

---

## 1. Overview

### 1.1 Purpose
This document defines the technical design for the **Task Management CRUD** application: a web application that lets authenticated users create, view, update, and delete tasks. It translates the behavioral requirements in `taskadmin.feature` into a concrete architecture, data model, API contract, validation rules, and UI specification.

### 1.2 Scope
In scope: authentication prerequisite, task list ("My Tasks" dashboard), task detail page, task create/edit form, status filtering, delete confirmation flow, and all validation/error paths covered by the feature file.

Out of scope (future work): task assignment/sharing, subtasks, attachments, comments, notifications, recurring tasks, offline mode.

### 1.3 Reference stack
The environment supports **Node.js v24.18.1** and **npm 11.12.1** (see `agents.md`); the default reference stack is:

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24 | LTS-line, available in dev environment |
| API | Express 5 (REST, JSON) | Stateless, session/JWT auth |
| Persistence | SQLite (via `better-sqlite3`) | Zero-config; swap for PostgreSQL in production |
| Frontend | Single-page app (vanilla or lightweight framework) | Talks to the REST API only |
| Testing | Vitest + Supertest (API), Playwright (E2E/Gherkin runner) | Gherkin steps mapped 1:1 to step definitions |

The API contract in §5 is stack-agnostic and remains valid if the persistence layer or framework changes.

---

## 2. Architecture

### 2.1 High-level

```
┌────────────┐   HTTPS/JSON   ┌─────────────┐   SQL   ┌──────────┐
│  Web Client │ ─────────────▶ │  API Server  │ ──────▶ │ Database │
│ (SPA / UI)  │ ◀───────────── │ (Express 5)  │ ◀────── │ (SQLite) │
└────────────┘   2xx/4xx/5xx  └─────────────┘         └──────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Auth Middleware   │
                              │ (JWT / session)  │
                              └─────────────────┘
```

### 2.2 Request lifecycle
1. Client sends request with `Authorization: Bearer <token>`.
2. **Auth middleware** validates the token; on failure → `401`.
3. **Route handler** parses and validates input (§4); on failure → `400`/`422`.
4. **Service layer** executes the business operation in a single DB transaction.
5. Resource not found (wrong id **or not owned by the caller**) → `404`.
6. Success → `200`/`201` with the updated resource representation; a success flash message is shown by the client (§6.3).

### 2.3 Layering
```
routes/  → controllers/  → services/  → repositories/ (SQL)
                ↑
          validators/  middleware/
```
Business rules (validation, ownership, status timestamps) live in the **service layer** so they are enforced identically for UI and API clients.

---

## 3. Data Model

### 3.1 Entity: `Task`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, autoincrement | Server-generated identifier (feature file uses `"9999"` as a non-existent id) |
| `title` | VARCHAR(200) | NOT NULL | Required; trimmed before save |
| `description` | TEXT | NULL allowed, default `NULL` | Optional; empty string normalized to `NULL` |
| `status` | ENUM | NOT NULL, default `TODO` | `TODO` \| `IN_PROGRESS` \| `DONE` (labels: "To Do", "In Progress", "Done") |
| `priority` | ENUM | NOT NULL, default `MEDIUM` | `LOW` \| `MEDIUM` \| `HIGH` (labels: "Low", "Medium", "High") |
| `due_date` | DATE | NULL allowed | ISO-8601 (`YYYY-MM-DD`) |
| `owner_id` | INTEGER | NOT NULL, FK → `users.id`, indexed | Enforces per-user isolation |
| `completed_at` | TIMESTAMP | NULL allowed | Set when status first becomes `DONE`; cleared if status reverts |
| `created_at` | TIMESTAMP | NOT NULL, default `CURRENT_TIMESTAMP` | Used for list ordering (newest first) |
| `updated_at` | TIMESTAMP | NOT NULL, auto-updated | Maintained by ORM/trigger |

**Indexes:** `(owner_id, status)`, `(owner_id, created_at DESC)`.

### 3.2 Entity: `User` (auth prerequisite only)

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PK, autoincrement |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE |
| `password_hash` | VARCHAR(255) | NOT NULL (argon2/bcrypt) |
| `created_at` | TIMESTAMP | NOT NULL, default `CURRENT_TIMESTAMP` |

### 3.3 State machine — `status`

```
        ┌──────────┐   update    ┌───────────────┐   update    ┌──────┐
        │  TO DO   │ ──────────▶ │ IN_PROGRESS   │ ──────────▶ │ DONE │
        │(To Do)   │ ◀────────── │(In Progress)  │ ◀────────── │(Done)│
        └──────────┘   update    └───────────────┘   update    └──────┘
```
- All three transitions are legal in any direction (the feature file exercises only `IN_PROGRESS → DONE`, but no rule forbids re-opening).
- **Side effect on entering `DONE`:** set `completed_at = NOW()`.
- **Side effect on leaving `DONE`:** set `completed_at = NULL`.

### 3.4 Enum ↔ display label mapping

| Internal | UI label |
|---|---|
| `TODO` | "To Do" |
| `IN_PROGRESS` | "In Progress" |
| `DONE` | "Done" |
| `LOW` | "Low" |
| `MEDIUM` | "Medium" |
| `HIGH` | "High" |

---

## 4. Validation Rules

Validation runs both client-side (immediate feedback) and server-side (authoritative). Server rules take precedence.

| # | Field | Rule | Error message (exact string) | Feature scenario |
|---|---|---|---|---|
| V1 | `title` | Required; must be non-empty **after trimming** | `Title is required` | Create w/o title rejected; Update w/ empty title rejected |
| V2 | `title` | Max length 200 chars | `Title must be 200 characters or fewer` | (defensive) |
| V3 | `description` | Optional; max 5,000 chars | `Description must be 5000 characters or fewer` | Create w/ only title |
| V4 | `status` | Must be a valid enum value | `Invalid status value` | Filter, status change |
| V5 | `priority` | Must be a valid enum value | `Invalid priority value` | Create/update forms |
| V6 | `due_date` | Optional; valid ISO date, not in the past on create | `Due date must be a valid date` / `Due date cannot be in the past` | Create w/ due date |
| V7 | `id` (path) | Must exist **and** belong to the authenticated user; otherwise indistinguishable `404` | `Task not found` | All `@notfound` scenarios |

**Key invariants (from the feature file):**
- A rejected create/update performs **no write** — the store state is unchanged (transaction rollback).
- A rejected update leaves **all original field values intact**, not just `title`.
- Duplicate task titles are **allowed** (no uniqueness constraint); precondition "user has no task named X" is test setup, not a business rule.
- 404 responses must not reveal whether a task id exists for another user (no `403` on foreign tasks).

---

## 5. API Specification

Base path: `/api/v1`. All endpoints require `Authorization: Bearer <token>` unless noted. All request/response bodies are `application/json`.

### 5.1 Endpoint summary

| Method | Path | Purpose | Success | Feature tags |
|---|---|---|---|---|
| `POST` | `/tasks` | Create a task | `201` | `@create` |
| `GET` | `/tasks` | List tasks (newest first, optional filter) | `200` | `@view`, `@filter` |
| `GET` | `/tasks/:id` | Fetch one task | `200` | `@view`, `@notfound` |
| `PATCH` | `/tasks/:id` | Partial update (title, description, status, priority, due_date) | `200` | `@update`, `@notfound` |
| `DELETE` | `/tasks/:id` | Delete a task | `204` (no body) | `@delete`, `@notfound` |

> UI-level delete confirmation is a client concern (§6.4); the API itself performs an unconditional delete once called.

### 5.2 `POST /api/v1/tasks`

Request:
```json
{
  "title": "Book dentist appointment",
  "description": "Call the clinic to schedule a checkup",
  "due_date": "2026-10-30",
  "priority": "HIGH",
  "status": "TODO"
}
```
- `title`: **required** (V1). `description`, `due_date`, `priority`, `status`: optional; defaults `NULL` / `NULL` / `MEDIUM` / `TODO`.

Response `201 Created`:
```json
{
  "id": 42,
  "title": "Book dentist appointment",
  "description": "Call the clinic to schedule a checkup",
  "status": "TODO",
  "priority": "HIGH",
  "due_date": "2026-10-30",
  "completed_at": null,
  "created_at": "2026-10-19T10:55:00Z",
  "updated_at": "2026-10-19T10:55:00Z"
}
```

Error (V1):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Title is required", "fields": { "title": "Title is required" } } }
```
Status: `422 Unprocessable Entity`.

### 5.3 `GET /api/v1/tasks`

Query parameters:
| Param | Type | Default | Notes |
|---|---|---|---|
| `status` | enum | — | `TODO` \| `IN_PROGRESS` \| `DONE` — filters the list (feature: filter by "Done") |
| `priority` | enum | — | Optional secondary filter |
| `page`, `limit` | int | `1`, `50` | Pagination; `limit` max 100 |

Ordering: `created_at DESC` (**most recently created first** — asserted by the list scenario).

Response `200`:
```json
{ "data": [ /* Task[] */ ], "meta": { "total": 3, "page": 1, "limit": 50 } }
```

### 5.4 `GET /api/v1/tasks/:id`

- `200` → full Task object.
- `404` when the id doesn't exist **or** belongs to another user:
  ```json
  { "error": { "code": "NOT_FOUND", "message": "Task not found" } }
  ```
- Malformed non-numeric id → `400` (`Invalid task id`).

### 5.5 `PATCH /api/v1/tasks/:id`

Request (any subset of mutable fields):
```json
{ "title": "Buy groceries and cook dinner", "description": "Milk, eggs, pasta, and tomatoes" }
```
```json
{ "status": "DONE" }
```
Behavior:
- All provided fields validated (§4); a single invalid field rejects the **entire** update (`422`) and no column is modified.
- Setting `status: "DONE"` sets `completed_at`; reverting clears it (§3.3).
- Only whitelisted fields are accepted — attempts to change `id`, `owner_id`, `created_at` are ignored (or `422`).
- Success → `200` with the full updated Task.
- Not found → `404 Task not found`.

### 5.6 `DELETE /api/v1/tasks/:id`
- `204 No Content` on success (body empty).
- `404` when not found/not owned.
- Idempotency note: a second delete of a deleted id returns `404`, matching the `@delete @notfound` contract.

### 5.7 Error envelope (uniform)

```json
{ "error": { "code": "<MACHINE_CODE>", "message": "<HUMAN MESSAGE>", "fields": { "<field>": "<message>" } } }
```

| HTTP | `code` | When |
|---|---|---|
| `400` | `BAD_REQUEST` | Malformed JSON, non-numeric id, invalid enum in query |
| `401` | `UNAUTHORIZED` | Missing/expired/invalid auth token |
| `404` | `NOT_FOUND` | Task does not exist or is not owned by caller |
| `422` | `VALIDATION_ERROR` | Business validation failure (V1–V6) |
| `500` | `INTERNAL_ERROR` | Unexpected server failure |

---

## 6. UI Specification

### 6.1 Views
| View | Route | Contents |
|---|---|---|
| Task list ("My Tasks" dashboard) | `/` or `/tasks` | Task rows/cards (title, status badge, priority badge, due date), status filter control, "New Task" button |
| Task detail | `/tasks/:id` | Full task fields, "Edit" and "Delete" buttons |
| Task create/edit form | `/tasks/new`, `/tasks/:id/edit` | Fields: title (required), description (textarea), status, priority, due date; "Save" button |

### 6.2 Task list behavior
- Sorted by `created_at` descending — **newest task appears first**.
- Status filter control (`To Do` / `In Progress` / `Done` / All) refetches with `?status=...`; only matching tasks render.
- Newly created tasks appear immediately (refetch or optimistic insert).

### 6.3 Feedback messages (exact strings from feature file)
| Trigger | Message | Presentation |
|---|---|---|
| Successful create | `Task created successfully` | Success toast/flash, auto-dismiss ≥3 s |
| Successful update | `Task updated successfully` | Success toast/flash |
| Successful delete | `Task deleted successfully` | Success toast/flash |
| Validation failure | `Title is required` (or field-specific) | Inline error under the field **and** form-level alert; form remains populated |

### 6.4 Delete confirmation flow
1. User clicks **Delete** on the task detail page.
2. Modal dialog: "Are you sure you want to delete this task?" with **Confirm** and **Cancel**.
3. **Confirm** → `DELETE /tasks/:id` → on `204`, navigate to task list, show `Task deleted successfully`; list count decrements.
4. **Cancel** → modal closes, **no API call**, task remains intact.

### 6.5 Form validation UX
- Save submits to the API; on `422`, the `fields` map drives inline errors and **no navigation occurs** — the form keeps all entered values and the persisted record is unchanged.
- Client may pre-validate required title before submit for responsiveness, but server response is authoritative.

---

## 7. Security & Authorization

- All `/tasks` endpoints require authentication (`401` otherwise).
- Every query is scoped by `owner_id = current_user.id`; cross-user access returns `404`, never `403` (no resource enumeration).
- Input is parameterized (no string-concatenated SQL); all writes wrapped in transactions.
- Passwords stored as argon2/bcrypt hashes; tokens carry `user_id` + expiry; recommend 12 h access token / refresh rotation.
- Standard headers: `Content-Type`, rate limiting on auth endpoints, body size cap (e.g. 64 KB).

---

## 8. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | List `GET /tasks` p95 < 200 ms for 10,000 tasks per user (via index §3.1); mutations p95 < 100 ms |
| Concurrency | Last-write-wins on `PATCH`; each mutation is a single atomic transaction |
| Data integrity | Referential integrity enforced by FKs; orphan tasks impossible |
| Auditability | `created_at` / `updated_at` / `completed_at` maintained on every write |
| Availability | CRUD API stateless → horizontally scalable behind a load balancer |
| Compatibility | Feature file is the acceptance baseline; any behavior change requires updating `taskadmin.feature` first |

---

## 9. Testing Strategy

| Level | Tool | Coverage target |
|---|---|---|
| Unit | Vitest | Validators (§4), status state machine (§3.3), service-layer rules |
| API integration | Vitest + Supertest (in-memory/temp SQLite) | Every endpoint × success, validation failure, 404 |
| E2E / acceptance | Playwright + Gherkin runner | Execute **all 15 scenarios** in `taskadmin.feature` on each release branch |
| Contract | Schema snapshots of §5 responses | Catch accidental response-shape drift |

Fixtures mirror the feature file's data tables (e.g., the three seed tasks used by the view/filter scenarios).

---

## 10. Traceability Matrix — Feature Scenario → Design Elements

| # | Scenario (feature file) | Tag(s) | Design elements |
|---|---|---|---|
| 1 | Create a new task with a title and description | `@create` | §3.1, §5.2, §6.1, message "Task created successfully" §6.3 |
| 2 | Create a new task with only a required title | `@create` | Defaults `description=NULL`, `priority=MEDIUM` (§3.1, §5.2) |
| 3 | Create a task without a title is rejected | `@create @validation` | V1, `422` envelope, inline error (§4, §5.7, §6.5) |
| 4 | View an existing task's details | `@view` | `GET /tasks/:id` §5.4, detail view §6.1, enum labels §3.4 |
| 5 | View the list sorted by creation date | `@view` | `created_at DESC` ordering §5.3, §6.2 |
| 6 | Filter tasks by status | `@view @filter` | `?status=` query param §5.3, filter control §6.2 |
| 7 | View a task that does not exist | `@view @notfound` | 404 envelope `Task not found` §5.4, §5.7 |
| 8 | Update an existing task's title and description | `@update` | `PATCH /tasks/:id` §5.5, message "Task updated successfully" §6.3 |
| 9 | Change a task's status to done | `@update` | Status state machine + `completed_at` §3.3, §5.5 |
| 10 | Update a task with an empty title is rejected | `@update @validation` | V1, all-or-nothing transaction §4, §5.5, §6.5 |
| 11 | Update a task that does not exist | `@update @notfound` | 404 §5.5, no-write guarantee §4 |
| 12 | Delete an existing task | `@delete` | `DELETE /tasks/:id` §5.6, confirm flow §6.4, message §6.3 |
| 13 | Cancel deleting a task | `@delete @cancel` | Modal cancel → no API call §6.4 |
| 14 | Delete a task that does not exist | `@delete @notfound` | 404 §5.6, §5.7 |
| 15 | Complete task lifecycle create → update → delete | `@lifecycle` | Full stack: §5.2 → §5.5 (status ×2) → §5.6, empty-list assertion §5.3 |

---

## 11. Milestones

| Phase | Deliverable |
|---|---|
| M1 — Foundation | DB schema + migrations (§3), auth middleware (§7), seed fixtures |
| M2 — CRUD API | All five endpoints (§5) with validation (§4) + integration tests |
| M3 — UI | List, detail, form views (§6), toasts, delete modal |
| M4 — Acceptance | Gherkin E2E suite green against `taskadmin.feature`; performance checks (§8) |

---

## 12. Open Questions

1. Should task titles be unique **per user** despite the feature file allowing duplicates? (Current design: duplicates allowed.)
2. Pagination vs. infinite scroll for the task list — spec assumes offset pagination (§5.3).
3. Should the `completed_at` timestamp be user-visible in the UI detail view? (Currently stored, not surfaced in §6.)
4. Offline/optimistic updates — deferred to a later iteration.
