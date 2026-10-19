// model.js — Task factory, validation, enums, helpers.

export const STATUSES = ["To Do", "In Progress", "Done"];
export const PRIORITIES = ["Low", "Medium", "High"];

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Error carrying a per-field message map, e.g. { title: "Title is required" }. */
export class ValidationError extends Error {
  constructor(fields) {
    super(Object.values(fields)[0] || "Validation failed");
    this.name = "ValidationError";
    this.fields = fields;
  }
}

/** Error for a task id that does not exist. */
export class NotFoundError extends Error {
  constructor(message = "Task not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Validate a full task payload (create) or merged payload (update).
 * Returns { field: message } — empty object means valid.
 */
export function validateTask(data, { isNew = false } = {}) {
  const errors = {};

  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) {
    errors.title = "Title is required";
  } else if (title.length > MAX_TITLE) {
    errors.title = `Title must be ${MAX_TITLE} characters or fewer`;
  }

  if (typeof data.description === "string" && data.description.length > MAX_DESCRIPTION) {
    errors.description = `Description must be ${MAX_DESCRIPTION} characters or fewer`;
  }

  if (data.status !== undefined && !STATUSES.includes(data.status)) {
    errors.status = "Invalid status value";
  }

  if (data.priority !== undefined && !PRIORITIES.includes(data.priority)) {
    errors.priority = "Invalid priority value";
  }

  const due = data.dueDate;
  if (due !== undefined && due !== "") {
    if (!ISO_DATE.test(due) || Number.isNaN(Date.parse(due))) {
      errors.dueDate = "Due date must be a valid date";
    } else if (isNew && due < todayISO()) {
      errors.dueDate = "Due date cannot be in the past";
    }
  }

  return errors;
}

/** Generate a unique id for a new task. */
export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `t${Date.now()}${Math.random().toString(16).slice(2)}`;
}

/** Build a new Task from user input. Throws ValidationError when invalid. */
export function createTask(data) {
  const errors = validateTask(data, { isNew: true });
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);

  const now = new Date().toISOString();
  return {
    id: newId(),
    title: data.title.trim(),
    description: typeof data.description === "string" ? data.description.trim() : "",
    status: STATUSES.includes(data.status) ? data.status : "To Do",
    priority: PRIORITIES.includes(data.priority) ? data.priority : "Medium",
    dueDate: data.dueDate || "",
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Apply status side effects in place: completedAt set on "Done", cleared otherwise. */
export function applyStatusEffects(task) {
  if (task.status === "Done") {
    if (!task.completedAt) task.completedAt = new Date().toISOString();
  } else {
    task.completedAt = null;
  }
  return task;
}

/** Return tasks matching the given status ("All" returns everything). */
export function filterByStatus(tasks, status) {
  if (!status || status === "All") return tasks.slice();
  return tasks.filter((t) => t.status === status);
}
